import { z } from 'zod';
import {
	buildAvailabilitiesSchema,
	toClockValue,
} from '@/app/(dashboard)/dashboard/product/availability.schema';
import {
	nextAvailabilityKey,
	type ProductAvailabilityFormType,
} from '@/app/(dashboard)/dashboard/product/form-availability-product.component';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import { toCalendarValue } from '@/helpers/date.helper';
import {
	getFormDataAsEnum,
	getFormDataAsJsonList,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import {
	PRODUCT_DEFAULT_TYPE,
	PRODUCT_DEFAULT_UNIT,
	ProductCompositionEnum,
	type ProductContentType,
	type ProductModel,
	type ProductRefType,
	type ProductType,
	ProductTypeEnum,
	type ProductUnit,
	ProductUnitEnum,
	toCategoryRefs,
	toTagRefs,
} from '@/models/product.model';
import {
	groupStoredAttributes,
	hasAttributeValue,
	type ProductAttributeFormType,
	toAttributePayload,
} from '@/models/product-category-attribute.model';
import type { ProductVariantModel } from '@/models/product-variant.model';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_sku',
	'invalid_type',
	'invalid_unit',
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
	'invalid_currency',
	'invalid_price',
	'min_price_above_price',
	'invalid_quantity',
	'components_required',
	'attribute_required',
	'components_too_few',
	'component_duplicate',
	'invalid_availability',
	'availability_end_before_start',
	'availability_hours_paired',
	'availability_day_duplicate',
	'availability_every_day_exclusive',
] as const;

/**
 * One component row as the form holds it.
 *
 * `variant_id` is the whole of what the API takes; `sku` and `label` are display-only, carried so
 * the row can name what it points at without a second round trip on every re-parse. `key` is
 * client-only row identity, the same device `ProductVariantFormType` uses - a component has no
 * id until it is saved, and the array index is not stable across a reorder.
 */
export type ProductBundleComponentFormType = {
	key: string;
	variant_id: number;
	// display-only fields, not part of validation
	sku: string;
	label: string;
	/*
	 * Text, not numbers, for every figure the user types. A controlled input whose value is
	 * `String(Number(raw))` cannot hold a half-typed decimal: "149." parses to 149 and renders
	 * back as "149", so the point is swallowed and the next keystroke lands in the units column
	 * ("149.90" became 14990). The string is the truth until the validator coerces it.
	 */
	quantity: string;
};

/**
 * Row keys only have to be unique within one form, so a counter is enough - and unlike
 * `crypto.randomUUID()` it does not need a secure context, which the plain-http dev host is not.
 */
let componentKeySequence = 0;

export function nextComponentKey(): string {
	componentKeySequence += 1;

	return `component-${componentKeySequence}`;
}

export function emptyComponent(
	variant: ProductVariantModel,
): ProductBundleComponentFormType {
	return {
		key: nextComponentKey(),
		variant_id: variant.id,
		sku: variant.sku,
		label: variant.product?.contents?.[0]?.label ?? '',
		quantity: '1',
	};
}

export type ProductBundleFormValuesType = {
	type: ProductType;
	unit: ProductUnit;

	available_from: string | null;
	available_until: string | null;
	discontinued_at: string | null;

	brand_id: number | null;

	contents: ProductContentType[];
	categories: ProductRefType[];
	tags: ProductRefType[];

	/*
	 * The bundle's own default variant, flattened: a bundle carries exactly one, the header line
	 * the components hang off, so there is no set to edit and no default to choose. `track_stock`
	 * is not here either - it is forced false on the way out.
	 */
	sku: string;
	// Text for the same reason as `ProductBundleComponentFormType.quantity`.
	prices: {
		currency: string;
		sale_price: string;
		reference_price: string;
		min_price: string;
	}[];

	/**
	 * The answers to the `product`-scoped definitions the bundle's categories declare. The
	 * `variant`-scoped ones are not asked: a bundle is one sellable line, so an axis meant to
	 * tell siblings apart has nothing to distinguish, and its default variant carries none.
	 */
	attributes: ProductAttributeFormType[];

	components: ProductBundleComponentFormType[];
	/** Recurring ordering windows. Empty means unrestricted - see `FormAvailabilityProduct`. */
	availabilities: ProductAvailabilityFormType[];

	/*
	 * Sentinel leaf fields the set-wide rules report on. `accumulateZodErrors` keys a list's
	 * per-entry errors by index, so a message about the *set* has nowhere to land unless it is
	 * given a plain field of its own.
	 */
	components_rule: string | null;
	prices_rule: string | null;
	// display-only fields, not part of validation
	brand_label: string | null;
};

class ProductBundleValidator extends BaseValidator<typeof validatorMessages> {
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
	 * ISO 4217, upper-cased so `ron` and `RON` reach the same `(variant_id, currency)` unique
	 * index rather than passing as two prices for one market.
	 */
	private readonly currencySchema = z
		.string({ message: this.getMessage('invalid_currency') })
		.refine((value) => value.trim().length === 3, {
			message: this.getMessage('invalid_currency'),
		})
		.transform((value) => value.trim().toUpperCase());

	/**
	 * A figure the user typed: text in, number out.
	 *
	 * Coerced here rather than on every keystroke, which is what lets the input hold a partial
	 * decimal. `Number('')` is 0, so blank is rejected explicitly instead of passing as free.
	 */
	private readonly amountSchema = (message: string) =>
		z
			.string({ message })
			.refine(
				(value) =>
					value.trim() !== '' && Number.isFinite(Number(value)),
				{ message },
			)
			.transform(Number);

	/** The same, but blank means "not set" rather than invalid. */
	private readonly optionalAmountSchema = (message: string) =>
		z
			.string({ message })
			.refine(
				(value) =>
					value.trim() === '' || Number.isFinite(Number(value)),
				{ message },
			)
			.transform((value) => (value.trim() === '' ? null : Number(value)));

	/**
	 * The bundle's own headline price, shaped exactly as a variant's - it is stored as one, on
	 * the single default variant the bundle carries. `reference_price` is what the kit would
	 * cost bought piece by piece, which is the saving the bundle is sold on; it is display only
	 * and never charged.
	 */
	private readonly priceSchema = z
		.object({
			currency: this.currencySchema,
			sale_price: this.amountSchema(this.getMessage('invalid_price')),
			reference_price: this.optionalAmountSchema(
				this.getMessage('invalid_price'),
			),
			min_price: this.optionalAmountSchema(
				this.getMessage('invalid_price'),
			),
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

	/** One answer, shaped exactly as the product form's - see `product.definition.ts`. */
	private readonly attributeEntrySchema = z.object({
		attribute_label_id: z.number(),
		value_type: z.string(),
		is_required: z.boolean(),
		terms: z.array(z.object({ id: z.number() })),
		text: z.string(),
		boolean: z.boolean(),
	});

	private readonly componentSchema = z.object({
		key: z.string(),
		variant_id: z
			.number({ message: this.getMessage('invalid_reference') })
			.positive({ message: this.getMessage('invalid_reference') }),
		sku: z.string(),
		label: z.string(),
		quantity: this.amountSchema(this.getMessage('invalid_quantity')).refine(
			(value) => value > 0,
			{
				message: this.getMessage('invalid_quantity'),
			},
		),
	});

	/**
	 * Shared with the product form, which writes the same `availabilities` array to the same
	 * endpoint - a bundle is a product, and its ordering hours are not a different problem.
	 */
	private readonly availabilitiesSchema = buildAvailabilitiesSchema({
		invalid: this.getMessage('invalid_availability'),
		endBeforeStart: this.getMessage('availability_end_before_start'),
		hoursPaired: this.getMessage('availability_hours_paired'),
		dayDuplicate: this.getMessage('availability_day_duplicate'),
		everyDayExclusive: this.getMessage('availability_every_day_exclusive'),
	});

	// Same JSON-field reasoning as `priceSchema`: the ids arrive as numbers already.
	private readonly refSchema = z.object({
		id: z
			.number({ message: this.getMessage('invalid_reference') })
			.positive({ message: this.getMessage('invalid_reference') }),
		// Carried through validation so the picker's chips survive a re-parse; stripped by
		// `prepareProductBundleParams`, which sends the ids alone.
		label: z.string(),
	});

	manage = z
		.object({
			type: this.validateEnum(
				ProductTypeEnum,
				this.getMessage('invalid_type'),
			),
			unit: this.validateEnum(
				ProductUnitEnum,
				this.getMessage('invalid_unit'),
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
						const languages = contents.map(
							(content) => content.language,
						);

						return new Set(languages).size === languages.length;
					},
					{ message: this.getMessage('duplicate_contents') },
				),
			categories: this.refSchema
				.array()
				.min(1, this.getMessage('categories_required')),
			tags: this.refSchema.array(),
			sku: z
				.string({ message: this.getMessage('invalid_sku') })
				.transform((value) => value.trim())
				.refine((value) => value.length > 0 && value.length <= 255, {
					message: this.getMessage('invalid_sku'),
				}),
			prices: z.array(this.priceSchema).min(1, {
				message: this.getMessage('invalid_price'),
			}),
			attributes: this.attributeEntrySchema.array(),
			components: this.componentSchema
				.array()
				.min(1, this.getMessage('components_required')),
			// No minimum, unlike components: an empty list means orderable at any time.
			availabilities: this.availabilitiesSchema,
			components_rule: z.string().nullable(),
			prices_rule: z.string().nullable(),
			brand_label: z.string().nullable(),
		})
		.superRefine((data, ctx) => {
			data.attributes.forEach((attribute, index) => {
				if (attribute.is_required && !hasAttributeValue(attribute)) {
					ctx.addIssue({
						code: 'custom',
						path: ['attributes', index],
						message: this.getMessage('attribute_required'),
					});
				}
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

			/*
			 * `syncItems` keys on `variant_id`, so a component listed twice collapses into one
			 * row with the later quantity, silently. Same class of trap as the duplicate
			 * currency above: the server is not a backstop here.
			 */
			const variantIds = data.components.map(
				(component) => component.variant_id,
			);

			if (new Set(variantIds).size !== variantIds.length) {
				ctx.addIssue({
					code: 'custom',
					path: ['components_rule'],
					message: this.getMessage('component_duplicate'),
				});
			}

			/*
			 * A bundle has to be more than one thing, or it is a product wearing a bundle's
			 * clothes. Counted in units rather than rows, so one component taken twice is a
			 * bundle and two components taken once each is too - the same figure
			 * `assertBundleIsComposed` sums on the backend.
			 */
			const componentUnits = data.components.reduce(
				(total, component) => total + Number(component.quantity),
				0,
			);

			if (componentUnits < 2) {
				ctx.addIssue({
					code: 'custom',
					path: ['components_rule'],
					message: this.getMessage('components_too_few'),
				});
			}

			const currencies = data.prices.map((price) => price.currency);

			if (new Set(currencies).size !== currencies.length) {
				ctx.addIssue({
					code: 'custom',
					path: ['prices_rule'],
					message: this.getMessage('invalid_currency'),
				});
			}
		});
}

export type ProductBundleManageOutput = ValidatorOutput<
	ProductBundleValidator,
	'manage'
>;

export async function validateProductBundleForm(
	values: ProductBundleFormValuesType,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'product-bundle',
	);

	const validator = new ProductBundleValidator(translations);

	return validator.manage.safeParse(values);
}

export function getProductBundleFormValues(
	formData: FormData,
): ProductBundleFormValuesType {
	return {
		type:
			getFormDataAsEnum(formData, 'type', ProductTypeEnum) ||
			PRODUCT_DEFAULT_TYPE,
		unit:
			getFormDataAsEnum(formData, 'unit', ProductUnitEnum) ||
			PRODUCT_DEFAULT_UNIT,
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
		sku: getFormDataAsString(formData, 'sku') ?? '',
		prices: getFormDataAsJsonList<
			ProductBundleFormValuesType['prices'][number]
		>(formData, 'prices'),
		attributes: getFormDataAsJsonList<ProductAttributeFormType>(
			formData,
			'attributes',
		),
		components: getFormDataAsJsonList<ProductBundleComponentFormType>(
			formData,
			'components',
		),
		availabilities: getFormDataAsJsonList<ProductAvailabilityFormType>(
			formData,
			'availabilities',
		),
		components_rule: null,
		prices_rule: null,
		brand_label: getFormDataAsString(formData, 'brand_label'),
	};
}

/**
 * Seeds both windows: create with `data` omitted, edit with the product `reloadEntry` returned.
 *
 * A stored component is seeded with its `variant_id` and no wording - `attachBranches` does not
 * join the variant behind a bundle item, and this function is synchronous. `FormComponentsBundle`
 * looks the names up itself, which also keeps a component whose variant no longer resolves in the
 * list under its bare id rather than dropping it silently on the next save.
 */
export function getProductBundleFormState(
	data?: ProductModel,
): FormStateType<ProductBundleFormValuesType> {
	const language = getLanguageClient();

	const variant = data?.variants?.find((entry) => entry.is_default);

	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			type: data?.type ?? PRODUCT_DEFAULT_TYPE,
			unit: data?.unit ?? PRODUCT_DEFAULT_UNIT,
			available_from: toCalendarValue(data?.available_from ?? null),
			available_until: toCalendarValue(data?.available_until ?? null),
			discontinued_at: toCalendarValue(data?.discontinued_at ?? null),
			brand_id: data?.brand_id ?? null,
			contents: data?.contents ?? [],
			categories: toCategoryRefs(data, language),
			tags: toTagRefs(data, language),
			sku: variant?.sku ?? '',
			prices: variant?.prices?.length
				? variant.prices.map((price) => ({
						currency: price.currency,
						sale_price:
							price.sale_price === null
								? ''
								: String(price.sale_price),
						reference_price:
							price.reference_price === null
								? ''
								: String(price.reference_price),
						min_price:
							price.min_price === null
								? ''
								: String(price.min_price),
					}))
				: [
						{
							currency: Configuration.get('app.currency'),
							sale_price: '',
							reference_price: '',
							min_price: '',
						},
					],
			attributes: groupStoredAttributes(data?.attributes),
			components: (data?.bundle_items ?? []).map((item) => ({
				key: nextComponentKey(),
				variant_id: item.variant_id,
				// Left blank on purpose - the editor resolves the wording; see above.
				sku: '',
				label: '',
				quantity: String(Number(item.quantity)),
			})),
			/*
			 * Trimmed to `HH:MM` for the same reason the product form does it: Postgres returns
			 * a `time` column as `HH:MM:SS`, which neither the picker nor the schema accepts.
			 */
			availabilities: (data?.availabilities ?? []).map(
				(availability) => ({
					...availability,
					starts_at: toClockValue(availability.starts_at),
					ends_at: toClockValue(availability.ends_at),
					key: nextAvailabilityKey(),
				}),
			),
			components_rule: null,
			prices_rule: null,
			brand_label: data?.brand?.name ?? null,
		},
	};
}

/**
 * Flattens the form onto the product payload.
 *
 * Two things this must get exactly right:
 *
 *  - **`composition` is always sent as `bundle`.** On create the column would otherwise default
 *    to `simple` and the components would be wiped by `saveComposition` in the same request.
 *  - **`track_stock` is forced false** on the bundle's own variant. Availability is the minimum
 *    over the components, nothing is ever received against the header, and that flag is what
 *    keeps it out of shipment allocation.
 */
export function prepareProductBundleParams(data: ProductBundleManageOutput) {
	const {
		components,
		attributes,
		availabilities,
		components_rule: _componentsRule,
		prices_rule: _pricesRule,
		brand_label: _brandLabel,
		categories,
		tags,
		sku,
		prices,
		...product
	} = data;

	return {
		...product,
		composition: ProductCompositionEnum.BUNDLE,
		categories: categories.map((ref) => ref.id),
		tags: tags.map((ref) => ref.id),
		attributes: toAttributePayload(attributes),
		variants: [
			{
				sku,
				is_default: true,
				track_stock: false,
				position: 0,
				prices,
				// A bundle's default variant answers nothing of its own - see `attributes`
				// on the form values for why the `variant` scope is not asked here.
				attributes: [],
			},
		],
		availabilities: availabilities.map(
			({ key: _key, ...availability }) => availability,
		),
		bundle_items: components.map((component, position) => ({
			variant_id: component.variant_id,
			quantity: component.quantity,
			position,
		})),
	};
}
