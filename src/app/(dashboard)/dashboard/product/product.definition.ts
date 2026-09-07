import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	buildAvailabilitiesSchema,
	toClockValue,
} from '@/app/(dashboard)/dashboard/product/availability.schema';
import {
	nextAvailabilityKey,
	type ProductAvailabilityFormType,
} from '@/app/(dashboard)/dashboard/product/form-availability-product.component';
import { FormBundleProduct } from '@/app/(dashboard)/dashboard/product/form-bundle-product.component';
import {
	FormManageProduct,
	type ProductFormValuesType,
} from '@/app/(dashboard)/dashboard/product/form-manage-product.component';
import {
	emptyVariant,
	nextVariantKey,
	type ProductVariantFormType,
} from '@/app/(dashboard)/dashboard/product/form-variants-product.component';
import { ManagerImagesProduct } from '@/app/(dashboard)/dashboard/product/manager-images-product.component';
import {
	getProductBundleFormState,
	getProductBundleFormValues,
	type ProductBundleManageOutput,
	prepareProductBundleParams,
	validateProductBundleForm,
} from '@/app/(dashboard)/dashboard/product/product-bundle.definition';
import { UsageGuideProduct } from '@/app/(dashboard)/dashboard/product/usage-guide-product.component';
import { ViewProduct } from '@/app/(dashboard)/dashboard/product/view-product.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import { toCalendarValue } from '@/helpers/date.helper';
import {
	getFormDataAsEnum,
	getFormDataAsJsonList,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayProductLabel,
	getProductLabel,
	PRODUCT_DEFAULT_COMPOSITION,
	PRODUCT_DEFAULT_TYPE,
	PRODUCT_DEFAULT_UNIT,
	PRODUCT_DEFAULT_VAT_CATEGORY,
	type ProductComposition,
	ProductCompositionEnum,
	type ProductContentType,
	type ProductModel,
	type ProductRefType,
	type ProductSaleStatus,
	type ProductType,
	ProductTypeEnum,
	ProductUnitEnum,
	ProductVatCategoryEnum,
	type ProductWorkflow,
	ProductWorkflowEnum,
	toCategoryRefs,
	toTagRefs,
} from '@/models/product.model';
import {
	groupStoredAttributes,
	hasAttributeValue,
	type ProductAttributeFormType,
	toAttributePayload,
} from '@/models/product-category-attribute.model';
import { requestUpdateProductWorkflow } from '@/services/product.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_sku',
	'invalid_type',
	'invalid_composition',
	'invalid_unit',
	'invalid_vat_category',
	'invalid_label',
	'invalid_slug',
	'invalid_language',
	'invalid_description',
	'invalid_meta_title',
	'invalid_meta_description',
	'invalid_meta_keywords',
	'invalid_reference',
	'invalid_brand_id',
	'invalid_date',
	'available_until_before_from',
	'categories_required',
	'invalid_variants',
	'variants_required',
	'invalid_availability',
	'availability_end_before_start',
	'availability_hours_paired',
	'availability_day_duplicate',
	'availability_every_day_exclusive',
	'variant_default_required',
	'variant_sku_duplicate',
	'attribute_required',
	'invalid_currency',
	'invalid_price',
	'min_price_above_price',
] as const;

class ProductValidator extends BaseValidator<typeof validatorMessages> {
	private readonly contentSchema = z.object({
		language: this.validateLanguage(this.getMessage('invalid_language')),
		label: this.validateString(this.getMessage('invalid_label')),
		slug: this.validateString(this.getMessage('invalid_slug')).transform(
			(value) => value.trim().toLowerCase(),
		),
		description: this.validateString(
			this.getMessage('invalid_description'),
			{ required: false },
		),
		meta: this.validateMeta({
			invalid_meta_title: this.getMessage('invalid_meta_title'),
			invalid_meta_description: this.getMessage(
				'invalid_meta_description',
			),
			invalid_meta_keywords: this.getMessage('invalid_meta_keywords'),
		}),
	});

	/**
	 * Prices exclude VAT, matching the column they feed. `min_price` is the floor a stacked
	 * discount may not resolve below, which is why it is checked against `price` here as well
	 * as by the backend — a table `@Check` violation would reach the client as a masked 500.
	 */
	private readonly priceSchema = z
		.object({
			// Upper-cased so `ron` and `RON` reach the same `(variant_id, currency)` unique
			// index rather than passing as two prices for one market.
			currency: this.validateString(this.getMessage('invalid_currency'))
				.refine((value) => value.trim().length === 3, {
					message: this.getMessage('invalid_currency'),
				})
				.transform((value) => value.trim().toUpperCase()),
			sale_price: this.validateNumber(this.getMessage('invalid_price'), {
				required: true,
				allowDecimals: 2,
			}),
			reference_price: this.validateNumber(
				this.getMessage('invalid_price'),
				{
					required: false,
					allowDecimals: 2,
				},
			),
			min_price: this.validateNumber(this.getMessage('invalid_price'), {
				required: false,
				allowDecimals: 2,
			}),
		})
		.refine(
			(data) =>
				data.min_price === null ||
				data.min_price === undefined ||
				data.min_price <= data.sale_price,
			{
				message: this.getMessage('min_price_above_price'),
				path: ['min_price'],
			},
		);

	/**
	 * Optional and nullable, matching the backend's own `nonNegative` and the nullable columns
	 * behind it. Declaring these required is stricter than the API and makes an existing row
	 * unsavable — a variant stored with no low-stock threshold could not be edited at all.
	 */
	private readonly nonNegative = (message: string) =>
		this.validateNumber(message, {
			required: false,
			onlyPositive: false,
		}).refine(
			(value) => value === null || value === undefined || value >= 0,
			{ message },
		);

	/**
	 * One answer to a category-declared attribute, as the form holds it.
	 *
	 * Deliberately unshaped beyond the entry: what makes a *value* valid is the definition
	 * governing its label — the option list, the bounds, the storage — and that lives in the
	 * resolved form the component holds, which this file never sees. The backend re-checks all
	 * of it on write. The one rule checkable here is the one the entry carries itself.
	 */
	private readonly attributeEntrySchema = z.object({
		attribute_label_id: z.number(),
		value_type: z.string(),
		is_required: z.boolean(),
		terms: z.array(z.object({ id: z.number() })),
		text: z.string(),
		boolean: z.boolean(),
	});

	private readonly variantSchema = z.object({
		// Client-only row identity — see `ProductVariantFormType`. In the schema so a re-parse
		// keeps it; stripped by `prepareParamsFromFormValues`.
		key: z.string(),
		sku: this.validateString(this.getMessage('invalid_sku'), {
			maxChars: 255,
		}).transform((value) => value.trim()),
		barcode: this.validateString(this.getMessage('invalid_variants'), {
			required: false,
			maxChars: 255,
		}),
		position: this.nonNegative(this.getMessage('invalid_variants')),
		is_default: z.boolean(),
		track_stock: z.boolean(),
		low_stock_threshold: this.nonNegative(
			this.getMessage('invalid_variants'),
		),
		allow_backorder: z.boolean(),
		// Zero is a legitimate cost (a sample, a giveaway), so the bound is `>= 0`
		cost_price: this.validateNumber(this.getMessage('invalid_price'), {
			required: false,
			onlyPositive: false,
			allowDecimals: 2,
		}).refine(
			(value) => value === null || value === undefined || value >= 0,
			{
				message: this.getMessage('invalid_price'),
			},
		),
		prices: z.array(this.priceSchema),
		// The variant's own axes, shaped like the product's — see the comment there.
		attributes: this.attributeEntrySchema.array(),
	});

	/**
	 * Shared with the bundle form, which writes the same `availabilities` array to the same
	 * endpoint — see `buildAvailabilitySchema` for why the rules live outside both validators.
	 */
	private readonly availabilitiesSchema = buildAvailabilitiesSchema({
		invalid: this.getMessage('invalid_availability'),
		endBeforeStart: this.getMessage('availability_end_before_start'),
		hoursPaired: this.getMessage('availability_hours_paired'),
		dayDuplicate: this.getMessage('availability_day_duplicate'),
		everyDayExclusive: this.getMessage('availability_every_day_exclusive'),
	});

	private readonly refSchema = z.object({
		id: this.validateId(this.getMessage('invalid_reference')),
		// Carried through validation so the picker's chips survive a re-parse; stripped by
		// `prepareParamsFromFormValues`, which sends the ids alone.
		label: z.string(),
	});

	manage = z
		.object({
			type: this.validateEnum(
				ProductTypeEnum,
				this.getMessage('invalid_type'),
			),
			composition: this.validateEnum(
				ProductCompositionEnum,
				this.getMessage('invalid_composition'),
			),
			unit: this.validateEnum(
				ProductUnitEnum,
				this.getMessage('invalid_unit'),
			),
			vat_category: this.validateEnum(
				ProductVatCategoryEnum,
				this.getMessage('invalid_vat_category'),
			),
			available_from: this.validateDate(this.getMessage('invalid_date'), {
				required: false,
			}),
			available_until: this.validateDate(
				this.getMessage('invalid_date'),
				{ required: false },
			),
			discontinued_at: this.validateDate(
				this.getMessage('invalid_date'),
				{ required: false },
			),
			brand_id: this.validateId(this.getMessage('invalid_brand_id'), {
				required: false,
			}),
			contents: this.contentSchema
				.array()
				.min(1, this.getMessage('invalid_contents'))
				.refine(
					(contents) => {
						const languages = contents.map((c) => c.language);

						return new Set(languages).size === languages.length;
					},
					{ message: this.getMessage('duplicate_contents') },
				),
			/*
			 * A product's attribute form is resolved from its categories, so one filed under
			 * nothing has no form to fill in. The public address does not depend on them —
			 * it is `/products/<product-slug>`, the slug alone.
			 */
			categories: this.refSchema
				.array()
				.min(1, this.getMessage('categories_required')),
			tags: this.refSchema.array(),
			// Every product carries at least one variant, because that is where price and
			// stock hang. A product with nothing to vary sends one.
			variants: this.variantSchema
				.array()
				.min(1, this.getMessage('variants_required')),
			// No minimum: an empty list means the product can be ordered at any time, which is
			// the common case and must not cost a row per weekday to express.
			availabilities: this.availabilitiesSchema,
			/*
			 * The answers to the category-declared attributes. Not shaped here beyond the
			 * entry itself: what makes a value valid is the definition governing its label,
			 * which lives in the resolved form the component holds and this file never sees.
			 * The required check runs there; everything else is the backend's, which re-checks
			 * the label, the option list and the bounds on every write.
			 */
			attributes: this.attributeEntrySchema.array(),
			// The sentinel the two set-wide variant rules report on — see the form values type.
			variants_rule: z.string().nullable(),
			// Display-only, carried so a re-parse does not blank the autocomplete inputs;
			// `prepareParamsFromFormValues` strips both.
			brand_label: z.string().nullable(),
		})
		.superRefine((data, ctx) => {
			/*
			 * A required attribute has to carry an answer. Reported on the entry rather than on
			 * the list, so the Attributes tab can put the message under the field that is
			 * missing one — the entries are index-aligned with the fields the form renders.
			 */
			data.attributes.forEach((attribute, index) => {
				if (attribute.is_required && !hasAttributeValue(attribute)) {
					ctx.addIssue({
						code: 'custom',
						path: ['attributes', index],
						message: this.getMessage('attribute_required'),
					});
				}
			});

			data.variants.forEach((variant, variantIndex) => {
				variant.attributes.forEach((attribute, index) => {
					if (
						attribute.is_required &&
						!hasAttributeValue(attribute)
					) {
						ctx.addIssue({
							code: 'custom',
							path: [
								'variants',
								variantIndex,
								'attributes',
								index,
							],
							message: this.getMessage('attribute_required'),
						});
					}
				});
			});

			if (
				data.available_from &&
				data.available_until &&
				data.available_until <= data.available_from
			) {
				ctx.addIssue({
					code: 'custom',
					path: ['available_until'],
					message: this.getMessage('available_until_before_from'),
				});
			}

			if (
				data.variants.filter((variant) => variant.is_default).length !==
				1
			) {
				ctx.addIssue({
					code: 'custom',
					path: ['variants_rule'],
					message: this.getMessage('variant_default_required'),
				});
			}

			const skus = data.variants.map((variant) => variant.sku);

			if (new Set(skus).size !== skus.length) {
				ctx.addIssue({
					code: 'custom',
					path: ['variants_rule'],
					message: this.getMessage('variant_sku_duplicate'),
				});
			}
		});
}

export type ProductManageOutput = ValidatorOutput<ProductValidator, 'manage'>;

export async function validateForm(values: ProductFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'product',
	);

	const validator = new ProductValidator(translations);

	return validator.manage.safeParse(values);
}

export function getFormValues(formData: FormData): ProductFormValuesType {
	return {
		type:
			getFormDataAsEnum(formData, 'type', ProductTypeEnum) ||
			PRODUCT_DEFAULT_TYPE,
		composition:
			getFormDataAsEnum(
				formData,
				'composition',
				ProductCompositionEnum,
			) || PRODUCT_DEFAULT_COMPOSITION,
		unit:
			getFormDataAsEnum(formData, 'unit', ProductUnitEnum) ||
			PRODUCT_DEFAULT_UNIT,
		vat_category:
			getFormDataAsEnum(
				formData,
				'vat_category',
				ProductVatCategoryEnum,
			) || PRODUCT_DEFAULT_VAT_CATEGORY,
		available_from: getFormDataAsString(formData, 'available_from'),
		available_until: getFormDataAsString(formData, 'available_until'),
		discontinued_at: getFormDataAsString(formData, 'discontinued_at'),
		brand_id: getFormDataAsNumber(formData, 'brand_id'),
		contents: getFormDataAsJsonList<ProductContentType>(
			formData,
			'contents',
		),
		categories: getFormDataAsJsonList<ProductRefType>(
			formData,
			'category_id',
		),
		tags: getFormDataAsJsonList<ProductRefType>(formData, 'tag_id'),
		/*
		 * `attributes` is defaulted rather than trusted: the list is parsed back from a hidden
		 * JSON field the form wrote, and a restored window draft can predate the key entirely.
		 * The validator requires it, so an absent one would fail the submit on a field the
		 * editor has no way to see.
		 */
		variants: getFormDataAsJsonList<ProductVariantFormType>(
			formData,
			'variants',
		).map((variant) => ({
			...variant,
			attributes: variant.attributes ?? [],
		})),
		availabilities: getFormDataAsJsonList<ProductAvailabilityFormType>(
			formData,
			'availabilities',
		),
		attributes: getFormDataAsJsonList<ProductAttributeFormType>(
			formData,
			'attributes',
		),
		variants_rule: null,
		brand_label: getFormDataAsString(formData, 'brand_label'),
	};
}

export function getFormState(
	data?: ProductModel,
): FormStateType<ProductFormValuesType> {
	const language = getLanguageClient();

	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			type: data?.type ?? PRODUCT_DEFAULT_TYPE,
			composition: data?.composition ?? PRODUCT_DEFAULT_COMPOSITION,
			unit: data?.unit ?? PRODUCT_DEFAULT_UNIT,
			vat_category: data?.vat_category ?? PRODUCT_DEFAULT_VAT_CATEGORY,
			available_from: toCalendarValue(data?.available_from ?? null),
			available_until: toCalendarValue(data?.available_until ?? null),
			discontinued_at: toCalendarValue(data?.discontinued_at ?? null),
			brand_id: data?.brand_id ?? null,
			contents: data?.contents ?? [],
			// `GET /products/:id` returns each link's wording alongside its id, so the pickers
			// seed themselves from the entry rather than a second round trip.
			categories: toCategoryRefs(data, language),
			tags: toTagRefs(data, language),
			/*
			 * At least one variant is always required, so a create form opens with the row
			 * already there rather than making the user discover the button. Stored variants
			 * are given their client-only key here, the one place they enter the form.
			 */
			variants: data?.variants?.length
				? data.variants.map((variant, position) => ({
						...variant,
						position,
						key: nextVariantKey(),
						// Same reason as the product's own, one level down
						attributes: groupStoredAttributes(variant.attributes),
					}))
				: [emptyVariant(0, true)],
			/*
			 * Unlike variants, no row is seeded — an empty list is the meaningful default, and a
			 * pre-filled window would silently restrict every new product to office hours.
			 */
			availabilities: (data?.availabilities ?? []).map(
				(availability) => ({
					...availability,
					/*
					 * Trimmed to `HH:MM`. Postgres hands a `time` column back as `HH:MM:SS`,
					 * which neither the picker nor `validateTime` accepts — a stored window
					 * would render as "09:00:00" and then fail validation on the next save
					 * without the user having touched it.
					 */
					starts_at: toClockValue(availability.starts_at),
					ends_at: toClockValue(availability.ends_at),
					key: nextAvailabilityKey(),
				}),
			),
			/*
			 * Grouped from the stored rows rather than built against the definitions: the form
			 * is seeded the moment the window opens, and `resolve` — which the component asks
			 * for once the categories are known — has not answered yet.
			 */
			attributes: groupStoredAttributes(data?.attributes),
			variants_rule: null,
			brand_label: data?.brand?.name ?? null,
		},
	};
}

/**
 * Strips the display-only fields and flattens the reference pickers to the id lists the backend
 * takes. `workflow` and `sale_status` are absent by design: the first moves through its own
 * route so the transition map is consulted, the second is derived by a backend cron.
 */
export function prepareParamsFromFormValues(data: ProductManageOutput) {
	/*
	 * `composition` is carried through the form so the panel knows what it is editing, but is
	 * never sent. `ProductService.saveComposition` wipes every bundle group and item the moment
	 * the saved row reads `simple`, and this form has no components editor — so a submit from
	 * here that named a composition would destroy a bundle's components. The listing no longer
	 * offers this form for a bundle, which makes that unreachable through the UI; omitting the
	 * key keeps it unreachable for any other caller, leaves the column alone on update, and
	 * lets the column's own default (`simple`) cover create.
	 */
	const {
		composition: _composition,
		variants_rule: _variantsRule,
		brand_label: _brandLabel,
		categories,
		tags,
		attributes,
		...product
	} = data;

	return {
		...product,
		categories: categories.map((ref) => ref.id),
		tags: tags.map((ref) => ref.id),
		// One row per recorded value — a term-backed answer may contribute several.
		attributes: toAttributePayload(attributes),
		// `key` is the form's own row identity and means nothing to the API.
		variants: product.variants.map(
			({ key: _key, attributes: variantAttributes, ...variant }) => ({
				...variant,
				attributes: toAttributePayload(variantAttributes ?? []),
			}),
		),
		availabilities: product.availabilities.map(
			({ key: _key, ...availability }) => availability,
		),
	};
}

export type ProductDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	workflow: { value: ProductWorkflow | null; matchMode: 'equals' };
	type: { value: ProductType | null; matchMode: 'equals' };
	composition: { value: ProductComposition | null; matchMode: 'equals' };
	sale_status: { value: ProductSaleStatus | null; matchMode: 'equals' };
	/* The typed text and the brand it resolved to — the backend filters on the id alone. */
	brand: { value: string | null; matchMode: 'equals' };
	brand_id: { value: number | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ProductModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'submitReview.title',
			'requestRevision.title',
			'markReady.title',
			'guide.title',
			'bundle.title',
			'bundleEdit.title',
			'managerImages.title',
		] as const,
		'product.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ProductModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'product', 'read') ? 'view' : undefined,
			dataSource: 'product',
		};
	}

	function displayButtonWorkflow(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ProductModel>['displayButton'] {
		return {
			action: (entry: ProductModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'product', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'product', 'update')) {
					return undefined;
				}

				/*
				 * The single next step, where the transition map leaves only one. From
				 * `pending_review` two moves are legal, so the row button stays out of it and
				 * the toolbar's own two actions decide.
				 */
				switch (entry.workflow) {
					case ProductWorkflowEnum.DRAFT:
					case ProductWorkflowEnum.REVISION_REQUIRED:
						return 'submitReview';
					default:
						return undefined;
				}
			},
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					workflow: { value: null, matchMode: 'equals' },
					type: { value: null, matchMode: 'equals' },
					composition: { value: null, matchMode: 'equals' },
					sale_status: { value: null, matchMode: 'equals' },
					brand: { value: '', matchMode: 'equals' },
					brand_id: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies ProductDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					/*
					 * `label` is not a column on the row — it comes from the joined
					 * translation — so the value is resolved here.
					 */
					field: 'label',
					header: 'Name',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// `?? undefined` because the column renders a missing
							// translation as its own placeholder, not as a blank cell
							customValue:
								getProductLabel(entry, getLanguageClient()) ??
								undefined,
							markDeleted: true,
						}),
				},
				{
					/*
					 * Not sortable: `order_by` on the product listing takes the product's own
					 * columns, and `brand` comes from a join.
					 */
					field: 'brand',
					header: 'Brand',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.brand?.name ?? undefined,
						}),
					minWidth: 140,
				},
				{
					field: 'type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'composition',
					header: 'Composition',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'workflow',
					header: 'Workflow',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'product',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonWorkflow(auth),
						}),
					minWidth: 160,
					maxWidth: 160,
				},
				{
					field: 'sale_status',
					header: 'Sale Status',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							dataSource: 'product',
							isStatus: true,
						}),
					minWidth: 148,
					maxWidth: 148,
				},
				{
					field: 'created_at',
					header: 'Created At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<ProductModel>('product', params),
		},
		displayEntryLabel: (entry: ProductModel) => displayProductLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageProduct,
				windowConfigProps: {
					size: 'xl3',
				},
				permission: ['product', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: ProductManageOutput) => {
					const params = prepareParamsFromFormValues(values);

					return requestCreate<ProductModel, typeof params>(
						'product',
						params,
					);
				},
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageProduct,
				windowConfigProps: {
					size: 'xl3',
				},
				permission: ['product', 'update'],
				entriesSelection: 'single',
				/*
				 * Not offered for a bundle, which `bundleEdit` opens instead: this form has no
				 * components editor, and its variants tab would invite an editor to add
				 * variants to a header line that carries exactly one by definition.
				 */
				customEntryCheck: (entry: ProductModel) =>
					!entry.deleted_at &&
					entry.composition !== ProductCompositionEnum.BUNDLE,
				operationFunction: (
					values: ProductManageOutput,
					id: number,
				) => {
					const params = prepareParamsFromFormValues(values);

					return requestUpdate<ProductModel, typeof params>(
						'product',
						params,
						id,
					);
				},
				/*
				 * The list row is a narrower projection than this form needs: its `contents`
				 * carry no `description` or `meta`, and its variants only `sku`/`track_stock`
				 * plus a price. Seeding the form from it would send those fields back empty and
				 * wipe them. `GET /products/:id` with no `language` returns every translation
				 * and the full variant rows, which is what the form edits.
				 */
				reloadEntry: (id: number) =>
					requestView<ProductModel>('product', id),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['product', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: ProductModel) =>
					requestDelete('product', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['product', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: ProductModel) =>
					requestRestore('product', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			/*
			 * One action per legal move in WORKFLOW_TRANSITIONS. `ready` is terminal, so nothing
			 * targets a product that has reached it — the backend refuses the move anyway, and
			 * an offered button that always fails is worse than an absent one.
			 */
			submitReview: {
				windowType: 'action',
				windowTitle: translations['submitReview.title'],
				permission: ['product', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.workflow, [
						ProductWorkflowEnum.DRAFT,
						ProductWorkflowEnum.REVISION_REQUIRED,
					]),
				operationFunction: (entry: ProductModel) =>
					requestUpdateProductWorkflow(
						entry.id,
						ProductWorkflowEnum.PENDING_REVIEW,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			requestRevision: {
				windowType: 'action',
				windowTitle: translations['requestRevision.title'],
				permission: ['product', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductModel) =>
					!entry.deleted_at &&
					entry.workflow === ProductWorkflowEnum.PENDING_REVIEW,
				operationFunction: (entry: ProductModel) =>
					requestUpdateProductWorkflow(
						entry.id,
						ProductWorkflowEnum.REVISION_REQUIRED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			markReady: {
				windowType: 'action',
				windowTitle: translations['markReady.title'],
				permission: ['product', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ProductModel) =>
					!entry.deleted_at &&
					entry.workflow === ProductWorkflowEnum.PENDING_REVIEW,
				operationFunction: (entry: ProductModel) =>
					requestUpdateProductWorkflow(
						entry.id,
						ProductWorkflowEnum.READY,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
			},
			managerImages: {
				windowType: 'other',
				windowTitle: translations['managerImages.title'],
				windowComponent: ManagerImagesProduct,
				windowConfigProps: {
					size: 'xl4',
				},
				permission: ['product', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
					icon: 'Image',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewProduct,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['product', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				reloadEntry: (id: number) =>
					requestView<ProductModel>('product', id),
			},
			/*
			 * The bundle editor, in its own window rather than this form.
			 *
			 * A bundle is a product, so it writes to the same endpoint — but the two forms differ
			 * enough that sharing one would mean a panel full of conditionals: a bundle carries
			 * components and no composition select, its VAT category is unused, and its single
			 * header variant replaces the variants tab. `bundle` creates one, `bundleEdit` opens
			 * an existing one, and both send `composition: 'bundle'`.
			 */
			bundle: {
				windowType: 'form',
				windowTitle: translations['bundle.title'],
				windowComponent: FormBundleProduct,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['product', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: ProductBundleManageOutput) => {
					const params = prepareProductBundleParams(values);

					return requestCreate<ProductModel, typeof params>(
						'product',
						params,
					);
				},
				/*
				 * The rules only the server can check — a component pointing at another bundle,
				 * a bundle containing itself, a variant that no longer exists — all come back as
				 * 422 with the reason in the message. `processForm` passes a backend message
				 * through verbatim only for a 409, so without this the user is told nothing but
				 * "form error".
				 */
				mapApiError: async (error) =>
					error.status === 422 ? { message: error.message } : {},
				buttonPosition: 'right',
				button: {
					variant: 'outline',
					icon: Icons.Bundle,
				},
				getFormValues: getProductBundleFormValues,
				validateForm: validateProductBundleForm,
				getFormState: getProductBundleFormState,
			},
			bundleEdit: {
				windowType: 'form',
				windowTitle: translations['bundleEdit.title'],
				windowComponent: FormBundleProduct,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['product', 'update'],
				entriesSelection: 'single',
				// Only a bundle has components to edit, and this form cannot make one out of a
				// simple product — every submit it sends says `bundle`.
				customEntryCheck: (entry: ProductModel) =>
					!entry.deleted_at &&
					entry.composition === ProductCompositionEnum.BUNDLE,
				operationFunction: (
					values: ProductBundleManageOutput,
					id: number,
				) => {
					const params = prepareProductBundleParams(values);

					return requestUpdate<ProductModel, typeof params>(
						'product',
						params,
						id,
					);
				},
				/*
				 * The list row carries no `bundle_items` at all — only `GET /products/:id`
				 * attaches them — so without this the form would open with an empty components
				 * list and wipe them on save.
				 */
				reloadEntry: (id: number) =>
					requestView<ProductModel>('product', id),
				/*
				 * The rules only the server can check — a component pointing at another bundle,
				 * a bundle containing itself, a variant that no longer exists — all come back as
				 * 422 with the reason in the message. `processForm` passes a backend message
				 * through verbatim only for a 409, so without this the user is told nothing but
				 * "form error".
				 */
				mapApiError: async (error) =>
					error.status === 422 ? { message: error.message } : {},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					icon: Icons.Bundle,
				},
				getFormValues: getProductBundleFormValues,
				validateForm: validateProductBundleForm,
				getFormState: getProductBundleFormState,
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideProduct,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['product', 'read'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Info,
				},
			},
		},
	};
}
