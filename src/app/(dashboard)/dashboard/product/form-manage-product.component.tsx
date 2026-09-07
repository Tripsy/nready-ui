import { useQuery, useQueryClient } from '@tanstack/react-query';
import isEqual from 'fast-deep-equal';
import { useEffect, useMemo, useState } from 'react';
import { FormAttributesProduct } from '@/app/(dashboard)/dashboard/product/form-attributes-product.component';
import {
	FormAvailabilityProduct,
	type ProductAvailabilityFormType,
} from '@/app/(dashboard)/dashboard/product/form-availability-product.component';
import { FormContentsProduct } from '@/app/(dashboard)/dashboard/product/form-contents-product.component';
import {
	FormOptionsProduct,
	type ProductOptionGroupFormType,
} from '@/app/(dashboard)/dashboard/product/form-options-product.component';
import { FormPickerProduct } from '@/app/(dashboard)/dashboard/product/form-picker-product.component';
import type { ProductVariantFormType } from '@/app/(dashboard)/dashboard/product/form-variants-product.component';
import { FormVariantsProduct } from '@/app/(dashboard)/dashboard/product/form-variants-product.component';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLanguageClient } from '@/config/translate.setup';
import {
	countTabErrors,
	ownErrorMessages,
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
	type ProductComposition,
	ProductCompositionEnum,
	type ProductContentType,
	type ProductRefType,
	type ProductType,
	ProductTypeEnum,
	type ProductUnit,
	ProductUnitEnum,
	type ProductVatCategory,
	ProductVatCategoryEnum,
	resolveProductUnit,
} from '@/models/product.model';
import {
	type ProductAttributeFormType,
	pruneAttributeValues,
} from '@/models/product-category-attribute.model';
import {
	displayTermLabel,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { requestResolvedAttributes } from '@/services/product.service';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export type ProductFormValuesType = {
	type: ProductType;
	/*
	 * Carried so the form knows whether it is editing a bundle, never edited and never
	 * submitted — `prepareParamsFromFormValues` strips it. See the comment there for why
	 * sending it at all is unsafe.
	 */
	composition: ProductComposition;
	unit: ProductUnit;
	vat_category: ProductVatCategory;

	available_from: string | null;
	available_until: string | null;
	discontinued_at: string | null;

	brand_id: number | null;

	contents: ProductContentType[];
	categories: ProductRefType[];
	tags: ProductRefType[];
	variants: ProductVariantFormType[];
	/**
	 * The answers to the `product`-scoped definitions the product's categories declare. The
	 * definitions themselves are not form state — they are fetched from `resolve` and change
	 * with the categories; this holds only what the editor filled in.
	 */
	attributes: ProductAttributeFormType[];
	/** Recurring ordering windows. Empty means unrestricted — see `FormAvailabilityProduct`. */
	availabilities: ProductAvailabilityFormType[];
	/**
	 * The questions asked at order time and what each answer does to the price. Empty means the
	 * product is ordered as it is — see `FormOptionsProduct`.
	 */
	option_groups: ProductOptionGroupFormType[];

	/*
	 * The two set-wide variant rules — exactly one default, no repeated SKU — report here rather
	 * than on `variants`, which holds one error object per row and so cannot also carry a
	 * group-level string. `accumulateZodErrors` discards a parent message that collides with
	 * nested ones, and says in its own docs that the fix is a leaf sentinel field. Never
	 * rendered as an input; stripped before the payload is built.
	 */
	variants_rule: string | null;

	// display-only fields, not part of validation
	brand_label: string | null;
};

const FORM_TABS = [
	{ id: 'details', label: 'Details' },
	{ id: 'content', label: 'Content' },
	{ id: 'variants', label: 'Variants' },
	// After Variants because a delta is measured against a variant's price — the thing being
	// modified has to be priced before modifying it means anything.
	{ id: 'options', label: 'Options' },
	{ id: 'availability', label: 'Availability' },
] as const;

type FormTabId = (typeof FORM_TABS)[number]['id'];

/** The product-level fields each tab owns, for the error counts on the tab strip. */
const TAB_FIELDS: Record<FormTabId, readonly (keyof ProductFormValuesType)[]> =
	{
		details: [
			'type',
			'unit',
			'vat_category',
			'brand_id',
			'categories',
			'tags',
			'attributes',
		],
		variants: ['variants', 'variants_rule'],
		options: ['option_groups'],
		availability: [
			'available_from',
			'available_until',
			'discontinued_at',
			'availabilities',
		],
		content: [],
	};

/** The per-language fields each tab owns — all of them belong to Content. */
const TAB_CONTENT_FIELDS: Record<FormTabId, readonly string[]> = {
	details: [],
	variants: [],
	options: [],
	availability: [],
	content: ['label', 'slug', 'description', 'meta'],
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

const productVatCategories = toOptionsFromEnum(ProductVatCategoryEnum, {
	formatter: formatEnumLabel,
});

/**
 * Namespaces the brand suggestion cache. Declared once because the query and the invalidation
 * that follows a create have to name the same key — a mismatch leaves the editor looking at the
 * empty result that sent them to the create window in the first place.
 */
const BRAND_SUGGESTIONS_KEY = 's-product-brand';

export function FormManageProduct() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ProductFormValuesType>();

	const elementIds = useElementIds([
		'type',
		'unit',
		'vatCategory',
		'availableFrom',
		'availableUntil',
		'discontinuedAt',
		'brand',
		'contents',
	] as const);

	const [tab, setTab] = useState<FormTabId>('details');
	const [searchBrand, setSearchBrand] = useState('');

	const { open, focus, getCurrentWindow } = useModalStore();
	const queryClient = useQueryClient();
	const { auth } = useAuth();

	// Offering a create the account may not perform would only defer the refusal to the submit
	const canCreateBrand = hasPermission(auth, 'brand', 'create');

	// A definition is gated on `product`, like the backend policy that writes it
	const canCreateAttribute = hasPermission(auth, 'product', 'create');

	// Both option pickers name a `term`, and creating one is written under `term`
	const canCreateTerm = hasPermission(auth, 'term', 'create');

	const { suggestions: brandSuggestions, isFetching: isBrandFetching } =
		useRemoteAutocomplete<BrandModel>({
			query: searchBrand,
			queryKey: [BRAND_SUGGESTIONS_KEY],
			queryFn: async (term) => {
				const response = await requestFind<BrandModel>('brand', {
					filter: { term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
		});

	/**
	 * Creates the brand from here once the search comes back empty, seeding its window with the
	 * typed name. Reusing that window is what keeps the new brand a complete record — it has a
	 * slug and per-language content the search box has nowhere to ask for.
	 *
	 * `open` minimizes this form to make room, so the parent is captured beforehand and focused
	 * again on success; otherwise the editor lands on an empty desktop with a half-filled
	 * product parked in the dock.
	 */
	const createBrand = (typedValue: string) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'brand',
			action: 'create',
			// `brand_type` is left to the form's own default — the enum holds `product` alone.
			data: { prefillEntry: { name: typedValue } },
			events: {
				success: async (entry?: BrandModel) => {
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					if (!entry) {
						return;
					}

					handleChange(
						'brand_label',
						displayBrandLabel(entry, false),
					);
					handleChange('brand_id', entry.id);
					setSearchBrand('');

					// The searches already run are cached, and the term that sent the editor
					// here is one of them — holding the empty result that prompted the create.
					await queryClient.invalidateQueries({
						queryKey: [BRAND_SUGGESTIONS_KEY],
					});
				},
			},
		});
	};

	/*
	 * The form a product in these categories answers. Refetched whenever the selection changes,
	 * because the resolved set is the union across them and their ancestors — adding a category
	 * can bring a whole group of fields with it.
	 */
	const categoryIds = formValues.categories.map((ref) => ref.id);

	/*
	 * Defaulted for the same reason the variant rows do it: `WindowForm` persists these values
	 * as a draft and restores them on reopen, so a draft written before this field existed comes
	 * back a shape older than the type says.
	 */
	const attributeValues = formValues.attributes ?? [];

	const { data: resolvedAttributes, refetch: refetchResolved } = useQuery({
		queryKey: ['product', 'resolved-attributes', [...categoryIds].sort()],
		queryFn: () => requestResolvedAttributes(categoryIds),
		enabled: categoryIds.length > 0,
	});

	const productDefinitions = useMemo(
		() => resolvedAttributes?.product ?? [],
		[resolvedAttributes],
	);
	const variantDefinitions = useMemo(
		() => resolvedAttributes?.variant ?? [],
		[resolvedAttributes],
	);

	/*
	 * The answers are reconciled against the resolved set the moment it changes: one entry per
	 * definition, empties included, and nothing for a label the categories no longer declare.
	 *
	 * Both halves matter. An empty entry is what lets the validator see a required attribute
	 * that was never filled in — it has no field of its own to report on otherwise. A leftover
	 * one would be sent against a label the backend does not declare, which it refuses outright,
	 * so removing a category on the Details tab would fail the whole save with nothing on
	 * screen to explain it.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the resolved set, not on the values it reconciles
	useEffect(() => {
		if (!resolvedAttributes) {
			return;
		}

		const reconciled = pruneAttributeValues(
			productDefinitions,
			attributeValues,
		);

		if (!isEqual(reconciled, attributeValues)) {
			handleChange('attributes', reconciled);
		}

		const variants = formValues.variants.map((variant) => ({
			...variant,
			attributes: pruneAttributeValues(
				variantDefinitions,
				variant.attributes ?? [],
			),
		}));

		// Guarded, like the product's own: an unconditional write would mark `variants` touched
		// on every resolve and surface its errors before the editor has been near the tab
		if (!isEqual(variants, formValues.variants)) {
			handleChange('variants', variants);
		}
	}, [productDefinitions, variantDefinitions, resolvedAttributes]);

	/**
	 * Declares a new attribute from here, against one of the product's own categories.
	 *
	 * The definition is not product state — it is a rule the category carries, and every product
	 * under that category answers it from then on. Which of them should own it is the one call
	 * this form cannot make, so the window is handed the product's categories and asks; with a
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
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					await refetchResolved();
				},
			},
		});
	};

	/**
	 * Names a question or an answer the picker could not find, by creating the `term` behind it.
	 *
	 * The term window rather than a name typed inline, for the same reason the brand picker uses
	 * it: a term is a row per language, and one created from a single typed string would be
	 * translated nowhere. `apply` is the picker that asked — the editor writes back into it
	 * rather than into a field this component can name, since either level of either row may
	 * have opened the window.
	 *
	 * `open` minimizes this form, so the parent is captured beforehand and focused again on
	 * success; without it the editor lands on an empty desktop with a half-filled product parked
	 * in the dock.
	 */
	const createOptionTerm = (
		typedValue: string,
		apply: (entry: TermModel) => void,
	) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'term',
			action: 'create',
			data: {
				prefillEntry: {
					type: TermTypeEnum.TEXT,
					contents: [
						{
							language: getLanguageClient(),
							value: typedValue,
						},
					],
				},
			},
			events: {
				success: (entry?: TermModel) => {
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					if (!entry) {
						return;
					}

					apply(entry);
				},
			},
		});
	};

	/**
	 * The validator reports on the entry, which is index-aligned with the fields the tab
	 * renders; the field component addresses them by label, since an index is not stable across
	 * a category change.
	 */
	const attributeErrors = useMemo(() => {
		const list = Array.isArray(errors.attributes) ? [] : errors.attributes;

		return Object.fromEntries(
			attributeValues.map((value, index) => [
				value.attribute_label_id,
				(list as Record<number, string[] | undefined> | undefined)?.[
					index
				],
			]),
		);
	}, [errors.attributes, attributeValues]);

	const unitOptions = productUnitsByType[formValues.type];

	const contentsError = ownErrorMessages(errors.contents);

	const contentErrorEntries: unknown[] = Array.isArray(errors.contents)
		? []
		: Object.values(errors.contents ?? {});

	// The list-level "at least one variant" message joins the two set-wide rules, which report
	// on their own sentinel field — all three describe the set rather than any one row.
	const variantRuleError = [
		...(ownErrorMessages(errors.variants) ?? []),
		...(errors.variants_rule ?? []),
	];

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
			 * Content (label, description) and SEO (slug, meta) together. Fields *inside* a
			 * panel still reach `FormData` — `TabsContent` force-mounts every panel and only
			 * hides the inactive ones — which is what lets the variants editor keep its own
			 * hidden input on the Variants tab.
			 */}
			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(
					Object.values(formValues.contents ?? []).filter(Boolean),
				)}
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
					<div className="space-y-4">
						<p className="flex items-start gap-1 text-xs text-muted">
							<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							Common details for all the product variants.
							Specific attributes are set on the Variants tab.
						</p>

						<div className="flex flex-wrap gap-2">
							<FormComponentSelect<ProductFormValuesType>
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

							<FormComponentSelect<ProductFormValuesType>
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

						{/*
						 * Carried, never shown as a control and never submitted: a product is
						 * made simple or bundle where its components are, not here. Without the
						 * hidden field the value would be dropped on the first re-parse and the
						 * notice below would vanish mid-edit.
						 */}
						<input
							type="hidden"
							name="composition"
							value={formValues.composition}
						/>

						{formValues.composition ===
							ProductCompositionEnum.BUNDLE && (
							<p className="rounded-md border border-line p-3 text-sm text-muted">
								This product is a bundle. Its name, content,
								categories, availability and price are edited
								here; its components are not — they are managed
								on the bundle page.
							</p>
						)}

						{/*
						 * A row of its own rather than beside the type and unit: it is a tax
						 * classification, not a description of the goods, and the note under it
						 * needs the width. The rate applies to the whole product — a `product`
						 * column, not a per-variant one — which is a costly thing to misread.
						 */}
						<div>
							<FormComponentSelect<ProductFormValuesType>
								labelText="VAT Category"
								id={elementIds.vatCategory}
								fieldName="vat_category"
								fieldValue={formValues.vat_category}
								options={productVatCategories}
								disabled={pending}
								onChange={(value) =>
									handleChange(
										'vat_category',
										value as ProductVatCategory,
									)
								}
								error={errors.vat_category}
								className="max-w-48"
							/>

							<p className="mt-1 flex items-start gap-1 text-xs text-muted">
								<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
								Applies to the whole product — every variant is
								taxed at this rate.
							</p>
						</div>

						<div className="flex flex-wrap gap-2">
							<input
								type="hidden"
								name="brand_id"
								value={formValues.brand_id ?? ''}
							/>

							<FormComponentAutoComplete<
								ProductFormValuesType,
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
									allowCreate: canCreateBrand,
									onCreate: createBrand,
									createLabel: (value) =>
										`Create brand "${value}"`,
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
							isRequired={true}
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
							// `product_tag.tag_id` is a plain foreign key to `term`, so the
							// backend accepts any row — without the filter the picker offers
							// the attribute labels and values too, and a product ends up
							// "tagged" with one of its own attribute values.
							filter={{ type: TermTypeEnum.TAG }}
							value={formValues.tags}
							onChange={(value) => handleChange('tags', value)}
							disabled={pending}
							error={ownErrorMessages(errors.tags)}
						/>

						{/*
						 * On this tab rather than one of its own: what a product is asked about
						 * follows directly from the categories picked just above, and the two
						 * read as one decision.
						 *
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
										title="Declare a new attribute for one of this product's categories"
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
										idPrefix="product"
										onDefinitionsChanged={refetchResolved}
									/>
								)
							) : (
								// No categories selected - show error message
								<p className="text-sm text-muted">
									Please select at least one category to view
									product attributes.
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

				<TabsContent id="variants">
					<div className="space-y-4">
						<p className="flex items-start gap-1 text-xs text-muted">
							<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							Pricing and inventory are managed at the variant
							level, not the product level. Define a separate
							variant for each distinct configuration (e.g.,
							different size, color, etc). Products that have no
							variations must still have exactly one default
							variant.
						</p>

						<FormVariantsProduct
							value={formValues.variants}
							onChange={(value) =>
								handleChange('variants', value)
							}
							attributeDefinitions={variantDefinitions}
							onDefinitionsChanged={refetchResolved}
							disabled={pending}
							errors={
								Array.isArray(errors.variants)
									? undefined
									: errors.variants
							}
							ruleError={
								variantRuleError.length
									? variantRuleError
									: undefined
							}
						/>
					</div>
				</TabsContent>

				<TabsContent id="options">
					<div className="space-y-4">
						<p className="flex items-start gap-1 text-xs text-muted">
							<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							A question asked at order time, and what each answer
							does to the price (eg: Extra bacon, a choice of
							crust, etc).
						</p>

						<FormOptionsProduct
							value={formValues.option_groups}
							onChange={(value) =>
								handleChange('option_groups', value)
							}
							disabled={pending}
							errors={errors.option_groups}
							canCreateTerm={canCreateTerm}
							onCreateTerm={createOptionTerm}
						/>
					</div>
				</TabsContent>

				<TabsContent id="availability">
					<div className="space-y-6">
						<p className="flex items-start gap-1 text-xs text-muted">
							<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							The dates below decide whether the product is listed
							at all; the intervals under them decide when a
							listed product can be ordered (eg: a lunch menu,
							weekdays 12:00–15:00).
						</p>

						<div className="space-y-2">
							<div className="flex flex-wrap gap-2">
								<FormComponentCalendar<ProductFormValuesType>
									labelText="Available From"
									id={elementIds.availableFrom}
									fieldName="available_from"
									fieldValue={formValues.available_from ?? ''}
									placeholderText="-select-"
									disabled={pending}
									onSelect={(value) =>
										handleChange(
											'available_from',
											value === '' ? null : value,
										)
									}
									error={errors.available_from}
								/>

								<FormComponentCalendar<ProductFormValuesType>
									labelText="Available Until"
									id={elementIds.availableUntil}
									fieldName="available_until"
									fieldValue={
										formValues.available_until ?? ''
									}
									placeholderText="-select-"
									disabled={pending}
									onSelect={(value) =>
										handleChange(
											'available_until',
											value === '' ? null : value,
										)
									}
									error={errors.available_until}
								/>

								<FormComponentCalendar<ProductFormValuesType>
									labelText="Discontinued At"
									id={elementIds.discontinuedAt}
									fieldName="discontinued_at"
									fieldValue={
										formValues.discontinued_at ?? ''
									}
									placeholderText="-select-"
									disabled={pending}
									onSelect={(value) =>
										handleChange(
											'discontinued_at',
											value === '' ? null : value,
										)
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
								life. A product outside its hours is still
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
