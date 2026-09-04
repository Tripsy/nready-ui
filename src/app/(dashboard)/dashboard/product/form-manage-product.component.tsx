import { useState } from 'react';
import {
	FormAvailabilityProduct,
	type ProductAvailabilityFormType,
} from '@/app/(dashboard)/dashboard/product/form-availability-product.component';
import { FormContentsProduct } from '@/app/(dashboard)/dashboard/product/form-contents-product.component';
import { FormPickerProduct } from '@/app/(dashboard)/dashboard/product/form-picker-product.component';
import type { ProductVariantFormType } from '@/app/(dashboard)/dashboard/product/form-variants-product.component';
import { FormVariantsProduct } from '@/app/(dashboard)/dashboard/product/form-variants-product.component';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
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
	displayTermLabel,
	type TermModel,
	TermTypeEnum,
} from '@/models/term.model';
import { useWindowForm } from '@/providers/window-form.provider';

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
	/** Recurring ordering windows. Empty means unrestricted — see `FormAvailabilityProduct`. */
	availabilities: ProductAvailabilityFormType[];

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
	{ id: 'availability', label: 'Availability' },
] as const;

type FormTabId = (typeof FORM_TABS)[number]['id'];

/** The product-level fields each tab owns, for the error counts on the tab strip. */
const TAB_FIELDS: Record<FormTabId, readonly (keyof ProductFormValuesType)[]> =
	{
		details: ['type', 'unit', 'brand_id', 'categories', 'tags'],
		variants: ['vat_category', 'variants', 'variants_rule'],
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

	const { suggestions: brandSuggestions, isFetching: isBrandFetching } =
		useRemoteAutocomplete<BrandModel>({
			query: searchBrand,
			queryKey: ['s-product-brand'],
			queryFn: async (term) => {
				const response = await requestFind<BrandModel>('brand', {
					filter: { term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
		});

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
					<div className="space-y-6 pt-4">
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
											displayBrandLabel(entry),
										);
										handleChange('brand_id', entry.id);
									},
									getOptionLabel: (entry) =>
										displayBrandLabel(entry),
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
							isRequired={true}
							disabled={pending}
							emptyMessage="A product's attribute form is resolved from its categories, so at least one is required."
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
							emptyMessage="No tags — optional."
							error={ownErrorMessages(errors.tags)}
						/>
					</div>
				</TabsContent>

				<TabsContent id="content">
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
					<div className="space-y-4 pt-4">
						{/*
						 * On this tab because it is a pricing decision, and price lives on the
						 * variants — but it is a column on `product`, not on each variant, so it
						 * sits above the list rather than inside a row. The note says so: a tax
						 * rate that looked per-variant would be a costly thing to misread.
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
							<p className="mt-1 flex items-center gap-1 text-xs text-muted">
								<Icons.Info className="h-3.5 w-3.5 shrink-0" />

								<span>
									Applies to the whole product - every variant
									below is taxed at this rate.
								</span>
							</p>
						</div>

						<FormVariantsProduct
							value={formValues.variants}
							onChange={(value) =>
								handleChange('variants', value)
							}
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

				<TabsContent id="availability">
					{/*
					 * Two sections, kept apart on purpose: the dates are absolute and describe
					 * the product's life in the catalog — they alone drive `sale_status` — while
					 * the windows below repeat within that life and leave it untouched. Same tab
					 * because both answer "when can this be bought", separate headings because
					 * merging them is what `.claude/rules/product.md` §9 warns against.
					 */}
					<div className="space-y-6 pt-4">
						<div className="space-y-2">
							<h3 className="text-sm font-semibold">
								Catalog window
							</h3>
							<p className="text-xs text-muted">
								When the product enters and leaves the catalog.
								These decide whether it is listed at all.
							</p>

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

						<div className="space-y-2 border-t border-line pt-4">
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
