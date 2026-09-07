'use client';

import { useQuery } from '@tanstack/react-query';
import isEqual from 'fast-deep-equal';
import { useEffect, useMemo, useState } from 'react';
import { FormAttributesProduct } from '@/app/(dashboard)/dashboard/product/form-attributes-product.component';
import { FormAvailabilityProduct } from '@/app/(dashboard)/dashboard/product/form-availability-product.component';
import { FormComponentsBundle } from '@/app/(dashboard)/dashboard/product/form-components-bundle.component';
import { FormContentsProduct } from '@/app/(dashboard)/dashboard/product/form-contents-product.component';
import { FormPickerProduct } from '@/app/(dashboard)/dashboard/product/form-picker-product.component';
import type { ProductBundleFormValuesType } from '@/app/(dashboard)/dashboard/product/product-bundle.definition';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentInput,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLanguageClient } from '@/config/translate.setup';
import {
	countTabErrors,
	ownErrorMessages,
	rowErrorsAt,
	toOptionsFromEnum,
} from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { hasPermission } from '@/models/account.model';
import { type BrandModel, displayBrandLabel } from '@/models/brand.model';
import {
	type CategoryModel,
	displayCategoryLabel,
} from '@/models/category.model';
import {
	PRODUCT_UNITS_BY_TYPE,
	type ProductType,
	ProductTypeEnum,
	type ProductUnit,
	ProductUnitEnum,
	resolveProductUnit,
} from '@/models/product.model';
import { pruneAttributeValues } from '@/models/product-category-attribute.model';
import { displayTermLabel, type TermModel } from '@/models/term.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { requestResolvedAttributes } from '@/services/product.service';
import { useModalStore } from '@/stores/window.store';
import { CurrencyEnum } from '@/types/common.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

/**
 * The markets a bundle may be priced in. A closed list rather than free text: the column is
 * `char(3)` and `(variant_id, currency)` is unique, so a typo does not fail — it silently
 * prices the bundle in a market nothing sells in.
 */
const CURRENCY_OPTIONS = toOptionsFromEnum(CurrencyEnum);

/**
 * Shared widths for the price grid's header and its row cells — change one and the columns drift.
 *
 * `shrink-0` because the width has to survive a cell whose content is wider than it: a field's
 * own wrapper grows to fit an error message under it, and without this the cell either absorbs
 * that width or gives it up, pushing everything to its right out of line with the header.
 */
const PRICE_COLUMN = {
	currency: 'w-28 shrink-0',
	amount: 'w-32 shrink-0',
} as const;

/** A blank market, for the row "Add currency" appends. */
const emptyPrice = (): ProductBundleFormValuesType['prices'][number] => ({
	currency: '',
	sale_price: '',
	reference_price: '',
	min_price: '',
});

const FORM_TABS = [
	{ id: 'details', label: 'Details' },
	{ id: 'content', label: 'Content' },
	{ id: 'components', label: 'Components' },
	{ id: 'price', label: 'Price' },
	{ id: 'availability', label: 'Availability' },
] as const;

type FormTabId = (typeof FORM_TABS)[number]['id'];

/** The bundle-level fields each tab owns, for the error counts on the tab strip. */
const TAB_FIELDS: Record<
	FormTabId,
	readonly (keyof ProductBundleFormValuesType)[]
> = {
	details: ['type', 'unit', 'brand_id', 'categories', 'tags', 'attributes'],
	content: [],
	price: ['sku', 'prices', 'prices_rule'],
	components: ['components', 'components_rule'],
	availability: [
		'available_from',
		'available_until',
		'discontinued_at',
		'availabilities',
	],
};

/** The per-language fields each tab owns — all of them belong to Content. */
const TAB_CONTENT_FIELDS: Record<FormTabId, readonly string[]> = {
	details: [],
	content: ['label', 'slug', 'description', 'meta'],
	price: [],
	components: [],
	availability: [],
};

const productTypes = toOptionsFromEnum(ProductTypeEnum, {
	formatter: formatEnumLabel,
});

/*
 * One option list per type rather than one for the enum: `toOptionsFromEnum` cannot subset, so
 * the narrowing happens here. Built once at module scope — the map is static.
 */
const productUnitsByType = Object.fromEntries(
	Object.values(ProductTypeEnum).map((type) => [
		type,
		toOptionsFromEnum(ProductUnitEnum, {
			formatter: formatEnumLabel,
		}).filter((option) =>
			PRODUCT_UNITS_BY_TYPE[type].includes(option.value as ProductUnit),
		),
	]),
) as Record<ProductType, ReturnType<typeof toOptionsFromEnum>>;

/**
 * The bundle editor, hosted in a window like every other entity form.
 *
 * A `WindowForm` child, which is what gives it the pipeline the product form has —
 * `processForm`, debounced live validation, draft persistence across a reload, and the submit
 * and cancel controls. This component is only the panels.
 *
 * Four tabs, and two of them differ from the product form on purpose. **Details** carries no
 * composition select (this form only ever writes `bundle`) and no VAT category (unused on a
 * bundle — the components carry their own). **Price** edits the bundle's single header variant
 * rather than a variant set, with the stock controls absent: availability is the minimum over
 * the components, and `track_stock` is forced false so the header stays out of shipment
 * allocation.
 */
export function FormBundleProduct() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ProductBundleFormValuesType>();

	const [tab, setTab] = useState<FormTabId>('details');
	const [searchBrand, setSearchBrand] = useState('');

	const { open, focus, getCurrentWindow } = useModalStore();
	const { auth } = useAuth();

	// A definition is gated on `product`, like the backend policy that writes it
	const canCreateAttribute = hasPermission(auth, 'product', 'create');

	const elementIds = useElementIds([
		'type',
		'unit',
		'brand',
		'sku',
		'availableFrom',
		'availableUntil',
		'discontinuedAt',
		'contents',
	] as const);

	const { suggestions: brandSuggestions, isFetching: isBrandFetching } =
		useRemoteAutocomplete<BrandModel>({
			query: searchBrand,
			queryKey: ['s-bundle-brand'],
			queryFn: async (term) => {
				const response = await requestFind<BrandModel>('brand', {
					filter: { term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
		});

	/*
	 * A bundle sits in categories like any product, so it answers the `product`-scoped
	 * definitions its categories declare. The `variant`-scoped ones are not asked here: a
	 * bundle is one sellable line with no siblings to be told apart from, so an axis like size
	 * or color has nothing to distinguish. Its default variant is therefore submitted with no
	 * attributes at all.
	 */
	const categoryIds = formValues.categories.map((ref) => ref.id);

	const { data: resolvedAttributes, refetch: refetchResolved } = useQuery({
		queryKey: ['product', 'resolved-attributes', [...categoryIds].sort()],
		queryFn: () => requestResolvedAttributes(categoryIds),
		enabled: categoryIds.length > 0,
	});

	const productDefinitions = useMemo(
		() => resolvedAttributes?.product ?? [],
		[resolvedAttributes],
	);
	const attributeValues = formValues.attributes ?? [];

	// Reconciled on every change to the resolved set — see the product form for why both halves
	// (filling the empties, dropping the undeclared) are needed
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the resolved set, not on the values it reconciles
	useEffect(() => {
		if (!resolvedAttributes) {
			return;
		}

		const reconciled = pruneAttributeValues(
			productDefinitions,
			formValues.attributes ?? [],
		);

		if (!isEqual(reconciled, formValues.attributes ?? [])) {
			handleChange('attributes', reconciled);
		}
	}, [productDefinitions, resolvedAttributes]);

	/** The validator reports on the entry; the field component addresses them by label. */
	const attributeErrors = ((): Record<number, string[] | undefined> => {
		const list = Array.isArray(errors.attributes) ? [] : errors.attributes;

		return Object.fromEntries(
			attributeValues.map((value, index) => [
				value.attribute_label_id,
				(list as Record<number, string[] | undefined> | undefined)?.[
					index
				],
			]),
		);
	})();

	/**
	 * Declares a new attribute from here, against one of the bundle's own categories.
	 *
	 * The definition is not bundle state — it is a rule the category carries, and every product
	 * under that category answers it from then on. Which of them should own it is the one call
	 * this form cannot make, so the window is handed the bundle's categories and asks; with a
	 * single category there is nothing to ask and it is seeded outright.
	 */
	const addAttribute = () => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'product-category-attribute',
			action: 'create',
			data: {
				prefillEntry: {
					category_id:
						formValues.categories.length === 1
							? formValues.categories[0].id
							: null,
					category_options: formValues.categories.map((ref) => ({
						id: ref.id,
						label: ref.label,
					})),
				},
			},
			events: {
				success: async () => {
					// `open` minimizes this form to make room, so the parent is focused again
					// on success; otherwise the editor lands on an empty desktop with a
					// half-filled bundle parked in the dock.
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					await refetchResolved();
				},
			},
		});
	};

	const unitOptions = productUnitsByType[formValues.type];

	const contentsError = ownErrorMessages(errors.contents);

	const contentErrorEntries: unknown[] = Array.isArray(errors.contents)
		? []
		: Object.values(errors.contents ?? {});

	// The list-level "at least one component" message joins the duplicate-variant rule, which
	// reports on its own sentinel field — both describe the set rather than any one row.
	const componentRuleError = [
		...(ownErrorMessages(errors.components) ?? []),
		...(errors.components_rule ?? []),
	];

	/*
	 * The whole set reaches the payload, because `syncPrices` reads it as the whole set: a row
	 * left out of the array is a market the bundle stops being sold in.
	 */
	const updatePrice = (
		index: number,
		patch: Partial<ProductBundleFormValuesType['prices'][number]>,
	) =>
		handleChange(
			'prices',
			formValues.prices.map((row, rowIndex) =>
				rowIndex === index ? { ...row, ...patch } : row,
			),
		);

	const addPrice = () =>
		handleChange('prices', [...formValues.prices, emptyPrice()]);

	const removePrice = (index: number) =>
		handleChange(
			'prices',
			formValues.prices.filter((_row, rowIndex) => rowIndex !== index),
		);

	/**
	 * Errors per tab, so one on a panel the editor cannot see still announces itself. Counted
	 * across every language rather than the open one — a missing Romanian label is the Content
	 * tab's problem whichever translation happens to be selected.
	 */
	const tabErrors = countTabErrors<FormTabId>({
		tabs: FORM_TABS,
		tabFields: TAB_FIELDS,
		tabContentFields: TAB_CONTENT_FIELDS,
		errors,
		contentErrors: contentErrorEntries,
		contentListError: contentsError,
		contentTabId: 'content',
	});

	return (
		<>
			{/*
			 * Outside the panels because no single one owns it: the payload is assembled from
			 * Content (label, description) and its SEO meta together. Fields *inside* a panel
			 * still reach `FormData` — `TabsContent` force-mounts every panel and only hides the
			 * inactive ones — which is what lets the components editor keep its own hidden input.
			 */}
			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(formValues.contents ?? [])}
			/>
			<input
				type="hidden"
				name="prices"
				value={JSON.stringify(formValues.prices)}
			/>

			<Tabs
				selectedKey={tab}
				onSelectionChange={(key) => setTab(key as FormTabId)}
				className="w-full"
			>
				<TabsList>
					{FORM_TABS.map(({ id, label }) => (
						<TabsTrigger key={id} id={id}>
							{label}
							{tabErrors[id] > 0 && (
								<span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">
									{tabErrors[id]}
									<span className="sr-only">
										{' '}
										field(s) need attention
									</span>
								</span>
							)}
						</TabsTrigger>
					))}
				</TabsList>

				<TabsContent id="details">
					<div className="space-y-6">
						<div className="flex flex-wrap gap-2">
							<FormComponentSelect<ProductBundleFormValuesType>
								labelText="Type"
								id={elementIds.type}
								fieldName="type"
								fieldValue={formValues.type}
								options={productTypes}
								disabled={pending}
								onChange={(value) => {
									const type = value as ProductType;

									handleChange('type', type);
									// A service priced per kilogram is not a thing the API
									// accepts, so the unit follows the type rather than being
									// left to fail validation later.
									handleChange(
										'unit',
										resolveProductUnit(
											type,
											formValues.unit,
										),
									);
								}}
								error={errors.type}
							/>

							<FormComponentSelect<ProductBundleFormValuesType>
								labelText="Unit"
								id={elementIds.unit}
								fieldName="unit"
								fieldValue={formValues.unit}
								options={unitOptions}
								// Nothing to choose when the type allows exactly one unit.
								disabled={pending || unitOptions.length < 2}
								onChange={(value) =>
									handleChange('unit', value as ProductUnit)
								}
								error={errors.unit}
							/>
						</div>

						<div>
							<input
								type="hidden"
								name="brand_id"
								value={formValues.brand_id ?? ''}
							/>

							<FormComponentAutoComplete<
								ProductBundleFormValuesType,
								BrandModel
							>
								labelText="Brand"
								id={elementIds.brand}
								fieldName="brand_label"
								fieldValue={formValues.brand_label ?? ''}
								className="pl-8"
								disabled={pending}
								icons={{
									left: (
										<Icons.Brand className="opacity-40 h-4.5 w-4.5" />
									),
								}}
								onInputChange={(value) => {
									handleChange('brand_label', value);
									// Typing past a chosen brand clears the id: the label alone
									// is not a selection, and leaving the old id would save a
									// brand the field no longer shows.
									handleChange('brand_id', null);
									setSearchBrand(value);
								}}
								autoCompleteProps={{
									suggestions: brandSuggestions,
									isLoading: isBrandFetching,
									onSelect: (entry) => {
										handleChange(
											'brand_label',
											displayBrandLabel(entry, false),
										);
										handleChange('brand_id', entry.id);
									},
									getOptionLabel: (entry) =>
										displayBrandLabel(entry, false),
									getOptionKey: (entry) => entry.id,
								}}
								error={errors.brand_id}
							/>
						</div>

						<FormPickerProduct
							labelText="Categories"
							fieldName="category_id"
							dataSource="category"
							getOptionLabel={(entry: CategoryModel) =>
								displayCategoryLabel(
									entry,
									getLanguageClient(),
									false,
								)
							}
							filter={{ type: 'product' }}
							value={formValues.categories}
							onChange={(value) =>
								handleChange('categories', value)
							}
							disabled={pending}
							error={ownErrorMessages(errors.categories)}
						/>

						<FormPickerProduct
							labelText="Tags"
							fieldName="tag_id"
							dataSource="term"
							getOptionLabel={(entry: TermModel) =>
								displayTermLabel(entry, getLanguageClient())
							}
							filter={{ type: 'tag' }}
							value={formValues.tags}
							onChange={(value) => handleChange('tags', value)}
							disabled={pending}
							error={ownErrorMessages(errors.tags)}
						/>

						{/*
						 * The answers ride to the backend as one JSON field, like every other
						 * collection in this form — `processForm` rebuilds its values from
						 * `FormData` on each submit, and a list of objects has no flat encoding.
						 */}
						<input
							type="hidden"
							name="attributes"
							value={JSON.stringify(attributeValues)}
						/>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-3 border-b border-line pb-2">
								<h3 className="font-bold">Attributes</h3>
								{categoryIds.length > 0 && (
									<Button
										type="button"
										variant="ghost"
										hover="success"
										disabled={
											pending || !canCreateAttribute
										}
										onClick={addAttribute}
										className="p-2 opacity-80 hover:opacity-100"
										title="Declare a new attribute for one of this bundle's categories"
									>
										<Icons.Action.Add className="h-4 w-4" />{' '}
										Add attribute
									</Button>
								)}
							</div>

							{categoryIds.length > 0 ? (
								// Categories selected - check if they have definitions
								productDefinitions.length === 0 ? (
									<p className="text-sm text-muted">
										Selected categories declare no product
										attributes.
									</p>
								) : (
									<FormAttributesProduct
										definitions={productDefinitions}
										values={attributeValues}
										onChange={(value) =>
											handleChange('attributes', value)
										}
										errors={attributeErrors}
										disabled={pending}
										idPrefix="bundle"
										onDefinitionsChanged={refetchResolved}
									/>
								)
							) : (
								// No categories selected - show error message
								<p className="text-sm text-muted">
									Please select at least one category to add
									bundle attributes.
								</p>
							)}
						</div>
					</div>
				</TabsContent>

				<TabsContent id="content">
					<p className="flex items-start gap-1 text-xs text-muted">
						<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						The wording, one set per language — name, slug,
						description and the SEO meta. The slug is the whole
						public address (eg: /products/my-slug), so changing it
						moves the page.
					</p>

					<FormContentsProduct
						contents={formValues.contents ?? []}
						pending={pending}
						elementIdPrefix={elementIds.contents}
						contentsError={contentsError}
						contentErrors={(value) => {
							const index = (formValues.contents ?? []).findIndex(
								(content) => content.language === value,
							);

							return index >= 0
								? errors.contents?.[index]
								: undefined;
						}}
						onChange={(contents) =>
							handleChange('contents', contents)
						}
					/>
				</TabsContent>

				<TabsContent id="components">
					<FormComponentsBundle
						value={formValues.components}
						pending={pending}
						errors={errors.components}
						setError={
							componentRuleError.length
								? componentRuleError
								: undefined
						}
						onChange={(value) => handleChange('components', value)}
					/>
				</TabsContent>

				<TabsContent id="price">
					<div>
						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								<strong className="font-semibold">
									Sale price
								</strong>{' '}
								is what the customer is charged, excluding VAT.
							</span>
						</p>

						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								<strong className="font-semibold">
									Reference price
								</strong>{' '}
								is the usual price the sale is measured against
								- shown to signal a saving.
							</span>
						</p>

						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								The discounted price cannot drop below the set{' '}
								<strong className="font-semibold">
									minimum price
								</strong>
							</span>
						</p>
					</div>

					<div className="space-y-4 pt-4">
						<FormComponentInput<ProductBundleFormValuesType>
							labelText="Bundle SKU"
							id={elementIds.sku}
							fieldName="sku"
							fieldValue={formValues.sku}
							isRequired={true}
							placeholderText="eg: MENU-BURGER"
							disabled={pending}
							onChange={(event) =>
								handleChange('sku', event.target.value)
							}
							error={errors.sku}
						/>

						{/*
						 * The column labels, once. Each "Add currency" then adds a row of fields
						 * beneath them, so a second market reads as another line of the same table
						 * rather than a second copy of the panel.
						 */}
						<div className="flex flex-nowrap gap-2 text-sm font-semibold">
							<span className={PRICE_COLUMN.currency}>
								Currency
								<span className="ml-1 text-danger">*</span>
							</span>
							<span className={PRICE_COLUMN.amount}>
								Sale price
								<span className="ml-1 text-danger">*</span>
							</span>
							<span className={PRICE_COLUMN.amount}>
								Reference price
							</span>
							<span className={PRICE_COLUMN.amount}>
								Minimum price
							</span>
						</div>

						{formValues.prices.map((row, index) => {
							/*
							 * The messages this market's own fields carry — a price row is
							 * validated field by field (`invalid_currency`, `invalid_price`,
							 * `min_price_above_price`), and those land on the row rather than
							 * on `prices`, so without this lookup they would be computed and
							 * never shown. The set-wide duplicate-currency rule stays below the
							 * grid on `prices_rule`, since it belongs to no single row.
							 */
							const rowErrors = rowErrorsAt<
								ProductBundleFormValuesType['prices'][number]
							>(errors.prices, index);

							/*
							 * A warning, not a rule — the same one the variants grid carries.
							 * `reference_price` means "what this would otherwise cost", so one
							 * below the sale price advertises an increase as a saving. Nothing
							 * downstream catches it: the table checks only `reference_price > 0`
							 * and no pricing path reads the column, so a transposed pair reaches
							 * the storefront unchallenged. Both figures are in the row's own
							 * currency, so no conversion is involved. Equal is not flagged — it
							 * advertises no saving rather than a false one.
							 */
							const referenceBelowSale =
								Number.isFinite(Number(row.reference_price)) &&
								row.reference_price.trim() !== '' &&
								row.sale_price.trim() !== '' &&
								Number(row.reference_price) <
									Number(row.sale_price);

							return (
								// Keyed by position, as the variants grid is: a price row has no
								// identity of its own, and its currency is empty until the editor
								// picks one.
								// biome-ignore lint/suspicious/noArrayIndexKey: no stable id on a price row
								<div key={index}>
									<div className="flex flex-nowrap items-start gap-2">
										{/* The width is on the cell, not the control — see PRICE_COLUMN. */}
										<div className={PRICE_COLUMN.currency}>
											<FormComponentSelect<{
												currency: string;
											}>
												id={`${elementIds.sku}-currency-${index}`}
												fieldName="currency"
												fieldValue={row.currency}
												isRequired={true}
												ariaLabel="Currency"
												className="w-full"
												options={CURRENCY_OPTIONS}
												disabled={pending}
												onChange={(value) =>
													updatePrice(index, {
														currency: value,
													})
												}
												error={ownErrorMessages(
													rowErrors?.currency,
												)}
											/>
										</div>

										<div className={PRICE_COLUMN.amount}>
											<FormComponentInput<{
												sale_price: string;
											}>
												id={`${elementIds.sku}-sale-price-${index}`}
												fieldName="sale_price"
												fieldValue={row.sale_price}
												isRequired={true}
												ariaLabel="Sale price"
												className="w-full"
												disabled={pending}
												onChange={(event) =>
													updatePrice(index, {
														sale_price:
															event.target.value,
													})
												}
												error={ownErrorMessages(
													rowErrors?.sale_price,
												)}
											/>
										</div>

										<div className={PRICE_COLUMN.amount}>
											<FormComponentInput<{
												reference_price: string;
											}>
												id={`${elementIds.sku}-reference-price-${index}`}
												fieldName="reference_price"
												fieldValue={row.reference_price}
												ariaLabel="Reference price"
												className="w-full"
												disabled={pending}
												onChange={(event) =>
													updatePrice(index, {
														reference_price:
															event.target.value,
													})
												}
												error={ownErrorMessages(
													rowErrors?.reference_price,
												)}
											/>
										</div>

										<div className={PRICE_COLUMN.amount}>
											<FormComponentInput<{
												min_price: string;
											}>
												id={`${elementIds.sku}-min-price-${index}`}
												fieldName="min_price"
												fieldValue={row.min_price}
												ariaLabel="Minimum price"
												className="w-full"
												disabled={pending}
												onChange={(event) =>
													updatePrice(index, {
														min_price:
															event.target.value,
													})
												}
												error={ownErrorMessages(
													rowErrors?.min_price,
												)}
											/>
										</div>

										{/* The last market cannot go: a bundle has to carry a price. */}
										{formValues.prices.length > 1 ? (
											<Button
												type="button"
												variant="ghost"
												hover="error"
												disabled={pending}
												onClick={() =>
													removePrice(index)
												}
												className="mt-1 p-2 opacity-60 hover:opacity-100"
												title={`Remove ${row.currency || 'this market'}`}
											>
												<Icons.Close className="h-4 w-4" />
											</Button>
										) : null}
									</div>

									{referenceBelowSale ? (
										<p className="mt-1 flex items-start gap-1 text-xs text-warning">
											<Icons.Status.Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
											<span>
												The reference price is below the
												sale price, so it advertises an
												increase rather than a saving.
											</span>
										</p>
									) : null}
								</div>
							);
						})}

						<div className="flex justify-end">
							<Button
								type="button"
								variant="ghost"
								hover="success"
								disabled={pending}
								onClick={addPrice}
								className="p-2 opacity-80 hover:opacity-100"
								title="Add currency"
							>
								<Icons.Action.Add className="h-4 w-4" /> Add
								currency
							</Button>
						</div>

						{errors.prices_rule?.length ? (
							<p className="text-sm text-danger">
								{errors.prices_rule.join(' ')}
							</p>
						) : null}

						{ownErrorMessages(errors.prices)?.length ? (
							<p className="text-sm text-danger">
								{ownErrorMessages(errors.prices)?.join(' ')}
							</p>
						) : null}
					</div>
				</TabsContent>

				<TabsContent id="availability">
					<div className="space-y-6">
						<p className="flex items-start gap-1 text-xs text-muted">
							<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							The dates below decide whether the bundle is listed
							at all; the intervals under them decide when a
							listed bundle can be ordered (eg: a lunch menu,
							weekdays 12:00–15:00).
						</p>

						<div className="space-y-2">
							<div className="flex flex-wrap gap-2">
								<FormComponentCalendar<ProductBundleFormValuesType>
									labelText="Available From"
									id={elementIds.availableFrom}
									fieldName="available_from"
									fieldValue={formValues.available_from}
									disabled={pending}
									onSelect={(value) =>
										handleChange('available_from', value)
									}
									error={errors.available_from}
								/>

								<FormComponentCalendar<ProductBundleFormValuesType>
									labelText="Available Until"
									id={elementIds.availableUntil}
									fieldName="available_until"
									fieldValue={formValues.available_until}
									disabled={pending}
									onSelect={(value) =>
										handleChange('available_until', value)
									}
									error={errors.available_until}
								/>

								<FormComponentCalendar<ProductBundleFormValuesType>
									labelText="Discontinued At"
									id={elementIds.discontinuedAt}
									fieldName="discontinued_at"
									fieldValue={formValues.discontinued_at}
									disabled={pending}
									onSelect={(value) =>
										handleChange('discontinued_at', value)
									}
									error={errors.discontinued_at}
								/>
							</div>
						</div>

						<div className="space-y-2">
							<h3 className="text-sm font-semibold">
								Ordering interval
							</h3>
							<p className="text-xs text-muted">
								One interval per day, recurring within that
								life. A bundle outside its hours is still
								listed, just not orderable right now.
							</p>

							<FormAvailabilityProduct
								value={formValues.availabilities}
								pending={pending}
								errors={errors.availabilities}
								onChange={(value) =>
									handleChange('availabilities', value)
								}
							/>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</>
	);
}
