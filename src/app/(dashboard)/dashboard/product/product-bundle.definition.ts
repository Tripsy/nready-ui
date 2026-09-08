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
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import {
	displayOptionLabel,
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
	resolveProductUnit,
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
	'invalid_date',
	'available_until_before_from',
	'categories_required',
	'invalid_currency',
	'invalid_price',
	'invalid_price_delta',
	'min_price_above_price',
	'invalid_quantity',
	'component_delta_not_chosen',
	'component_default_not_chosen',
	'component_optional_in_group',
	'invalid_group_label',
	'group_too_few_candidates',
	'group_default_duplicate',
	'group_label_duplicate',
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
 *
 * A row is one of three things. With no `group_key` it is part of the kit, or a tick box the
 * customer answers when `is_optional`. With one it is a candidate for that group, which decides
 * how many of its candidates are taken - so `is_optional` is refused there. Only a row the
 * customer chooses either way may carry `is_default` or a delta.
 *
 * The panel clears whatever a row stops offering in the same change, so the matching validator
 * rules are a backstop rather than something the editor can walk into.
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
	/*
	 * The group this row is a candidate for, by the group's own client-only `key` rather than by
	 * its label term: a group has no `label_id` until its picker is filled, and two half-filled
	 * groups would collide on null. Resolved to `group_label_id` on the way to the API.
	 */
	group_key: string | null;
	/*
	 * What `quantity` above means changes with this flag: how many the bundle contains when the
	 * component is always included, and the most the customer may take when it is optional. A
	 * candidate reads it the same way as an optional row, and carries this flag as false.
	 */
	is_optional: boolean;
	is_default: boolean;
	/*
	 * The signed adjustment to this component's own price, per market. Kept as a whole list
	 * rather than a figure per bundle currency, because the currencies live on another tab: a row
	 * whose market is dropped there simply stops rendering, and `prepareProductBundleParams`
	 * filters it out on the way to the API rather than the editor having to find and clear it.
	 */
	prices: { currency: string; price_delta: string }[];
};

/**
 * A choice group as the form holds it: a prompt, and nothing else.
 *
 * `label_id` is what the payload carries and `label` the wording the picker shows, the same split
 * `ProductOptionGroupFormType` makes. `key` is client-only row identity and what a component names
 * in `group_key`, so a group can be referred to before it has a label at all.
 *
 * No bounds, unlike an option group. Exactly one candidate is taken, which is the whole of what a
 * bundle choice means - see `ProductBundleGroupType` for why a bound over candidate rows could not
 * express the one case that would want it.
 */
export type ProductBundleGroupFormType = {
	key: string;
	label_id: number | null;
	// display-only, carried so the picker can name the term without a second round trip
	label: string;
};

let groupKeySequence = 0;

export function nextGroupKey(): string {
	groupKeySequence += 1;

	return `group-${groupKeySequence}`;
}

export function emptyGroup(): ProductBundleGroupFormType {
	return {
		key: nextGroupKey(),
		label_id: null,
		label: '',
	};
}

/** Whether the customer decides on this component at all - by its own tick box, or by a group. */
export function isComponentChosen(
	component: ProductBundleComponentFormType,
): boolean {
	return component.is_optional || component.group_key !== null;
}

/** The delta this component carries in one market, as text - blank when it carries none. */
export function componentDeltaFor(
	component: ProductBundleComponentFormType,
	currency: string,
): string {
	return (
		component.prices.find((price) => price.currency === currency)
			?.price_delta ?? ''
	);
}

/** The same row with one market's delta replaced, adding the market if it had none. */
export function withComponentDelta(
	component: ProductBundleComponentFormType,
	currency: string,
	price_delta: string,
): ProductBundleComponentFormType {
	const known = component.prices.some((price) => price.currency === currency);

	return {
		...component,
		prices: known
			? component.prices.map((price) =>
					price.currency === currency
						? { ...price, price_delta }
						: price,
				)
			: [...component.prices, { currency, price_delta }],
	};
}

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
		group_key: null,
		is_optional: false,
		is_default: false,
		prices: [],
	};
}

export type ProductBundleFormValuesType = {
	type: ProductType;
	unit: ProductUnit;

	available_from: string | null;
	available_until: string | null;
	discontinued_at: string | null;

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

	/*
	 * Flat and side by side, the shape both the API and the tables take: a component belongs to a
	 * group or to none, and one list beats two places to read it from. `components[].group_key`
	 * is the tie.
	 */
	groups: ProductBundleGroupFormType[];
	components: ProductBundleComponentFormType[];
	/** Recurring ordering windows. Empty means unrestricted - see `FormAvailabilityProduct`. */
	availabilities: ProductAvailabilityFormType[];

	/*
	 * Sentinel leaf fields the set-wide rules report on. `accumulateZodErrors` keys a list's
	 * per-entry errors by index, so a message about the *set* has nowhere to land unless it is
	 * given a plain field of its own.
	 */
	components_rule: string | null;
	groups_rule: string | null;
	prices_rule: string | null;
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

	/**
	 * One market's adjustment to the component's own price. Signed, unlike `priceSchema` - the
	 * usual case is negative, the discount for taking the component inside the kit.
	 *
	 * Blank means "no delta in this market" rather than zero, so a market the editor never filled
	 * in is dropped by `prepareProductBundleParams` instead of writing a row worth nothing.
	 */
	private readonly deltaSchema = z.object({
		currency: this.currencySchema,
		price_delta: this.optionalAmountSchema(
			this.getMessage('invalid_price_delta'),
		),
	});

	/**
	 * One choice group: its prompt, and nothing else. Exactly one candidate is taken, so there are
	 * no bounds to check here.
	 *
	 * How many candidates the group has spans this list and `components`, so it lives in the
	 * `superRefine` below, as it does in `assertBundleGroupsAreUsable` on the API.
	 */
	private readonly groupSchema = z.object({
		key: z.string(),
		label_id: this.validateId(this.getMessage('invalid_group_label')),
		label: z.string(),
	});

	private readonly componentSchema = z
		.object({
			key: z.string(),
			variant_id: z
				.number({ message: this.getMessage('invalid_reference') })
				.positive({ message: this.getMessage('invalid_reference') }),
			sku: z.string(),
			label: z.string(),
			quantity: this.amountSchema(
				this.getMessage('invalid_quantity'),
			).refine((value) => value > 0, {
				message: this.getMessage('invalid_quantity'),
			}),
			group_key: z.string().nullable(),
			is_optional: z.boolean(),
			is_default: z.boolean(),
			prices: z.array(this.deltaSchema),
		})
		/*
		 * The three guard one idea from three sides, and each mirrors a rule the API enforces. A
		 * component that is always included is covered by the bundle's own price, so a delta has
		 * nothing to adjust and preselecting something the customer cannot untick says nothing.
		 * A candidate is decided by its group, so claiming to be optional as well is a second
		 * answer to a question already answered. The panel clears whatever a row stops offering
		 * in the same change, so reaching any of the three means the values arrived from
		 * somewhere other than the editor.
		 */
		.refine((data) => !data.is_optional || data.group_key === null, {
			message: this.getMessage('component_optional_in_group'),
			path: ['is_optional'],
		})
		.refine(
			(data) =>
				data.is_optional || data.group_key !== null || !data.is_default,
			{
				message: this.getMessage('component_default_not_chosen'),
				path: ['is_default'],
			},
		)
		.refine(
			(data) =>
				data.is_optional ||
				data.group_key !== null ||
				data.prices.every((price) => price.price_delta === null),
			{
				message: this.getMessage('component_delta_not_chosen'),
				path: ['prices'],
			},
		);

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
			groups: this.groupSchema.array(),
			components: this.componentSchema
				.array()
				.min(1, this.getMessage('components_required')),
			// No minimum, unlike components: an empty list means orderable at any time.
			availabilities: this.availabilitiesSchema,
			components_rule: z.string().nullable(),
			groups_rule: z.string().nullable(),
			prices_rule: z.string().nullable(),
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
			 *
			 * Neither optional components nor candidates count, there or here: the floor has to
			 * hold for the least the customer can take. An optional one can be left unticked,
			 * and a group with a minimum of one guarantees *a* candidate rather than that one.
			 */
			const componentUnits = data.components.reduce(
				(total, component) =>
					component.is_optional || component.group_key !== null
						? total
						: total + Number(component.quantity),
				0,
			);

			if (componentUnits < 2) {
				ctx.addIssue({
					code: 'custom',
					path: ['components_rule'],
					message: this.getMessage('components_too_few'),
				});
			}

			/*
			 * Two groups on one label term would be one question asked twice - and the API keys
			 * `syncGroups` on `label_id`, so the second would silently overwrite the first.
			 */
			const groupLabels = data.groups.map((group) => group.label_id);

			if (new Set(groupLabels).size !== groupLabels.length) {
				ctx.addIssue({
					code: 'custom',
					path: ['groups_rule'],
					message: this.getMessage('group_label_duplicate'),
				});
			}

			/*
			 * The rules that span a group and its candidates, the pair
			 * `assertBundleGroupsAreUsable` reads back on the API. Reported per group rather than
			 * on the sentinel, since a bundle offering three choices otherwise says which rule
			 * broke without saying where.
			 */
			data.groups.forEach((group, index) => {
				const candidates = data.components.filter(
					(component) => component.group_key === group.key,
				);

				/*
				 * A choice takes exactly one candidate, so it needs two to be a choice: with one
				 * it is a component that is always included wearing a prompt.
				 */
				if (candidates.length < 2) {
					ctx.addIssue({
						code: 'custom',
						path: ['groups', index],
						message: this.getMessage('group_too_few_candidates'),
					});

					return;
				}

				/*
				 * A partial unique index on the API, so a second preselect arrives as a masked
				 * 500 rather than a message. Ungrouped tick boxes are outside the rule - they
				 * are not alternatives to each other - so this counts within the group alone.
				 */
				if (
					candidates.filter((candidate) => candidate.is_default)
						.length > 1
				) {
					ctx.addIssue({
						code: 'custom',
						path: ['groups', index],
						message: this.getMessage('group_default_duplicate'),
					});
				}
			});

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
	const type =
		getFormDataAsEnum(formData, 'type', ProductTypeEnum) ||
		PRODUCT_DEFAULT_TYPE;

	return {
		type,
		/*
		 * Derived rather than read from an input: a bundle is one kit sold as a single line, so
		 * the only unit that means anything is the type's own - a kit priced by weight or by the
		 * metre is not a thing. The column is not nullable, so it still has to carry a value, and
		 * `resolveProductUnit` picks the one the API's type/unit pairing accepts (piece, or hour
		 * for a service kit).
		 */
		unit: resolveProductUnit(type, PRODUCT_DEFAULT_UNIT),
		available_from: getFormDataAsString(formData, 'available_from'),
		available_until: getFormDataAsString(formData, 'available_until'),
		discontinued_at: getFormDataAsString(formData, 'discontinued_at'),
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
		groups: getFormDataAsJsonList<ProductBundleGroupFormType>(
			formData,
			'groups',
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
		groups_rule: null,
		prices_rule: null,
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

	/*
	 * Seeded before the components, which is the only ordering that works: a component names its
	 * group by the client-only key assigned here, so the keys have to exist before the rows that
	 * point at them are built.
	 */
	const storedGroups: ProductBundleGroupFormType[] = (
		data?.bundle_groups ?? []
	).map((group) => ({
		key: nextGroupKey(),
		label_id: group.label_id,
		label: displayOptionLabel(group.label, language, group.label_id),
	}));

	const groupKeyById = new Map(
		(data?.bundle_groups ?? []).map((group, index) => [
			group.id,
			storedGroups[index].key,
		]),
	);

	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			type: data?.type ?? PRODUCT_DEFAULT_TYPE,
			// Derived from the type, not seeded from the row - see `getProductBundleFormValues`.
			unit: resolveProductUnit(
				data?.type ?? PRODUCT_DEFAULT_TYPE,
				PRODUCT_DEFAULT_UNIT,
			),
			available_from: toCalendarValue(data?.available_from ?? null),
			available_until: toCalendarValue(data?.available_until ?? null),
			discontinued_at: toCalendarValue(data?.discontinued_at ?? null),
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
			groups: storedGroups,
			components: (data?.bundle_items ?? []).map((item) => ({
				key: nextComponentKey(),
				variant_id: item.variant_id,
				// Left blank on purpose - the editor resolves the wording; see above.
				sku: '',
				label: '',
				quantity: String(Number(item.quantity)),
				/*
				 * Back from the stored `group_id` to the client-only key the form ties rows by.
				 * A component whose group did not come back with the read lands ungrouped rather
				 * than holding a key nothing answers to - which the panel would then render as a
				 * blank selection and the validator refuse on save.
				 */
				group_key: groupKeyById.get(item.group_id ?? 0) ?? null,
				is_optional: item.is_optional,
				is_default: item.is_default,
				/*
				 * `Number()` before `String()` for the same reason `quantity` needs it: a
				 * `numeric` column arrives as a number here, but a null delta has to become the
				 * blank the input holds rather than the string "null".
				 */
				prices: (item.prices ?? []).map((price) => ({
					currency: price.currency,
					price_delta:
						price.price_delta === null
							? ''
							: String(Number(price.price_delta)),
				})),
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
			groups_rule: null,
			prices_rule: null,
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
		groups,
		components,
		attributes,
		availabilities,
		components_rule: _componentsRule,
		groups_rule: _groupsRule,
		prices_rule: _pricesRule,
		categories,
		tags,
		sku,
		prices,
		...product
	} = data;

	/*
	 * The markets the bundle is actually sold in. A component's deltas are filtered to these on
	 * the way out: the currencies are edited on another tab, and dropping one there would
	 * otherwise leave every component holding a delta for a market with no price - rows the API
	 * would accept and nothing would ever read.
	 */
	const currencies = new Set(prices.map((price) => price.currency));

	/*
	 * The form ties a component to its group by the client-only key; the API ties them by the
	 * group's label term, which is the one name a group created in this same request already has.
	 */
	const groupLabelByKey = new Map(
		groups.map((group) => [group.key, group.label_id]),
	);

	return {
		...product,
		composition: ProductCompositionEnum.BUNDLE,
		/*
		 * `brand_id` is absent on purpose: a bundle names no brand, since what it contains comes
		 * from several of them and the header line is the kit rather than any one maker's
		 * product. Sending `null` would not clear one either - the API's optional-id schema
		 * reads null as "not provided" and leaves the column at its stored value.
		 */
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
		/*
		 * Groups go out beside the components, not around them, and before them in the object for
		 * the same reason the service syncs them first: a component names a group the request may
		 * be creating. `key` is client-only and dropped here, `position` comes from array order.
		 */
		bundle_groups: groups.map(
			({ key: _key, label: _label, ...group }, position) => ({
				...group,
				position,
			}),
		),
		bundle_items: components.map((component, position) => ({
			variant_id: component.variant_id,
			quantity: component.quantity,
			position,
			group_label_id:
				component.group_key === null
					? null
					: (groupLabelByKey.get(component.group_key) ?? null),
			is_optional: component.is_optional,
			is_default: component.is_default,
			// A blank delta is not a zero one: the market simply carries no adjustment, and a
			// row saying so would be written and read back for nothing
			prices: component.prices.filter(
				(price) =>
					price.price_delta !== null &&
					currencies.has(price.currency),
			),
		})),
	};
}
