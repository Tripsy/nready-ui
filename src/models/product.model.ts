import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { capitalizeFirstLetter } from '@/helpers/string.helper';
import type { ImageStorage } from '@/models/image.model';
import type {
	MeasureUnit,
	ProductAttributeValueType,
} from '@/models/product-category-attribute.model';
import { MEASURE_UNIT_SYMBOLS } from '@/models/product-category-attribute.model';
import type { Language, StatusTransitions } from '@/types/common.type';
import type { ImagePropertiesType } from '@/types/image.type';
import type { PageMeta } from '@/types/page-meta.type';

/**
 * The editorial state a product moves through, changed only via
 * `PATCH /products/:id/workflow/:workflow` - never as a field on the manage form, because the
 * backend consults the transition map below on every move.
 */
export const ProductWorkflowEnum = {
	DRAFT: 'draft',
	PENDING_REVIEW: 'pending_review',
	REVISION_REQUIRED: 'revision_required',
	READY: 'ready',
} as const;

export type ProductWorkflow =
	(typeof ProductWorkflowEnum)[keyof typeof ProductWorkflowEnum];

// Mirrors WORKFLOW_TRANSITIONS in the backend entity. `ready` is terminal - nothing leads out
// of it, so a product that reaches it cannot be walked back through the workflow route.
export const WORKFLOW_TRANSITIONS: StatusTransitions<ProductWorkflow> = {
	[ProductWorkflowEnum.DRAFT]: [ProductWorkflowEnum.PENDING_REVIEW],
	[ProductWorkflowEnum.PENDING_REVIEW]: [
		ProductWorkflowEnum.REVISION_REQUIRED,
		ProductWorkflowEnum.READY,
	],
	[ProductWorkflowEnum.REVISION_REQUIRED]: [
		ProductWorkflowEnum.PENDING_REVIEW,
	],
	[ProductWorkflowEnum.READY]: [],
};

/**
 * Derived, never submitted: a backend cron recomputes it from `available_from`,
 * `available_until` and `discontinued_at`. It is display-and-filter only here - the timestamps
 * are what the form edits.
 */
export const ProductSaleStatusEnum = {
	AVAILABLE: 'available',
	COMING_SOON: 'coming_soon',
	UNAVAILABLE: 'unavailable',
	DISCONTINUED: 'discontinued',
} as const;

export type ProductSaleStatus =
	(typeof ProductSaleStatusEnum)[keyof typeof ProductSaleStatusEnum];

/** How the product is fulfilled. Orthogonal to `composition`. */
export const ProductTypeEnum = {
	PHYSICAL: 'physical',
	DIGITAL: 'digital',
	SERVICE: 'service',
} as const;

export type ProductType =
	(typeof ProductTypeEnum)[keyof typeof ProductTypeEnum];

/**
 * Whether the product is sold on its own or assembled from others. A `bundle` holds no stock and
 * its own `vat_category` is unused - the components carry both.
 */
export const ProductCompositionEnum = {
	SIMPLE: 'simple',
	BUNDLE: 'bundle',
} as const;

export type ProductComposition =
	(typeof ProductCompositionEnum)[keyof typeof ProductCompositionEnum];

/** The unit a variant's price is quoted per, and that a quantity is expressed in. */
export const ProductUnitEnum = {
	PIECE: 'piece',
	KG: 'kg',
	LITRE: 'litre',
	METRE: 'metre',
	HOUR: 'hour',
} as const;

export type ProductUnit =
	(typeof ProductUnitEnum)[keyof typeof ProductUnitEnum];

/**
 * The VAT *class* the product declares. The rate it resolves to depends on jurisdiction and date
 * and is snapshot onto the order line, so nothing here converts it to a percentage.
 */
export const ProductVatCategoryEnum = {
	STANDARD: 'standard',
	REDUCED: 'reduced',
	SECOND_REDUCED: 'second_reduced',
	ZERO: 'zero',
	EXEMPT: 'exempt',
} as const;

export type ProductVatCategory =
	(typeof ProductVatCategoryEnum)[keyof typeof ProductVatCategoryEnum];

// Mirror the column defaults on the backend entity
export const PRODUCT_DEFAULT_WORKFLOW = ProductWorkflowEnum.DRAFT;
export const PRODUCT_DEFAULT_TYPE = ProductTypeEnum.PHYSICAL;
export const PRODUCT_DEFAULT_COMPOSITION = ProductCompositionEnum.SIMPLE;
export const PRODUCT_DEFAULT_UNIT = ProductUnitEnum.PIECE;
export const PRODUCT_DEFAULT_VAT_CATEGORY = ProductVatCategoryEnum.STANDARD;

/**
 * Which units each type may be sold in. A service is priced by time, a download has no physical
 * dimension to measure, and only a physical good can be sold by weight, volume or length.
 *
 * Mirrored by a rule in the backend validator - this map is what the form offers, not what the
 * API accepts, and the two have to agree.
 */
export const PRODUCT_UNITS_BY_TYPE: Record<
	ProductType,
	readonly ProductUnit[]
> = {
	[ProductTypeEnum.PHYSICAL]: [
		ProductUnitEnum.PIECE,
		ProductUnitEnum.KG,
		ProductUnitEnum.LITRE,
		ProductUnitEnum.METRE,
	],
	[ProductTypeEnum.DIGITAL]: [ProductUnitEnum.PIECE],
	[ProductTypeEnum.SERVICE]: [ProductUnitEnum.HOUR],
};

/**
 * The unit to hold after a type change: the current one when that type still allows it, the
 * type's first otherwise. Every type allows at least one unit, so this always resolves.
 */
export function resolveProductUnit(
	type: ProductType,
	unit: ProductUnit,
): ProductUnit {
	const allowed = PRODUCT_UNITS_BY_TYPE[type];

	return allowed.includes(unit) ? unit : allowed[0];
}

export type ProductContentType = {
	language: Language;
	slug: string;
	label: string;
	description: string | null;
	meta: PageMeta;
};

/**
 * One market's price for a variant, excluding VAT.
 *
 * `min_price` is the floor a stacked discount may not resolve below, and the backend rejects a
 * `min_price` above `sale_price`. `reference_price` is display only - the usual price a saving is
 * measured against, never charged and read by no pricing path.
 */
export type ProductPriceType = {
	currency: string;
	sale_price: number | null;
	reference_price: number | null;
	min_price: number | null;
};

/**
 * The sellable unit - price and stock hang here, not on the product. Exactly one variant of a
 * product carries `is_default`, and SKUs are unique within the set.
 */
export type ProductVariantType = {
	sku: string;
	barcode: string | null;
	// Both nullable on the backend, where `nonNegative` is an optional check.
	position: number | null;
	is_default: boolean;
	track_stock: boolean;
	low_stock_threshold: number | null;
	allow_backorder: boolean;
	cost_price: number | null;
	prices: ProductPriceType[];
	/*
	 * The axes that tell this variant from its siblings, against `variant`-scoped definitions.
	 * Absent leaves the stored ones alone on a save; `[]` clears them - the same split the
	 * product-level list carries, and the reason neither is defaulted.
	 */
	attributes?: ProductAttributeValueType[];
};

/**
 * An axis value as the public listing joins it: the stored ids, plus the term wording that turns
 * `43 -> 50` into "Storage: 512 gb". Only the requested language is joined, so `contents` holds
 * at most one row.
 *
 * The same shape a product's own attribute arrives in, and deliberately so - the two tables differ
 * in what they mean (an axis tells siblings apart; an attribute describes the product) but not in
 * how a value is stored or rendered, and the specification table on the product page lists both
 * through one formatter.
 */
export type ProductVariantAxisType = ProductAttributeDisplayType;

/**
 * A variant as the public listing returns it (`attachVariants` on the backend).
 *
 * Narrower than `ProductVariantType` on purpose - the anonymous surface projects away
 * `cost_price`, `min_price` and the stock knobs, which describe the business rather than the
 * offer. The `id` is here because a card keys on it; the dashboard's variant rows key on a
 * client-side `key` instead, since an unsaved row has no id yet.
 */
export type ProductListVariantType = {
	id: number;
	sku: string;
	position: number | null;
	is_default: boolean;
	prices: Pick<
		ProductPriceType,
		'currency' | 'sale_price' | 'reference_price'
	>[];
	attributes?: ProductVariantAxisType[];
	/*
	 * The variant's own gallery cover, filed under the `product_variant` image section - the blue
	 * jacket rather than the jacket. `null` when it has a gallery of its own but nothing in it,
	 * which is the ordinary case: most variants differ by a number, not a picture.
	 */
	cover_image?: ProductCoverImageType | null;
	/*
	 * The whole of that gallery, present on the single-product read alone - a listing is handed
	 * the cover and nothing else, so a page of twelve products does not carry a hundred pictures.
	 * `cover_image` is its first entry whenever there is one.
	 */
	images?: ProductCoverImageType[];
};

/**
 * `GET /public/products/:slug` - the anonymous read.
 *
 * Same as `ProductModel` but for its variants, which the storefront surface projects down to
 * `ProductListVariantType` and hands over with their axis wording resolved. Nothing anonymous
 * ever sees `cost_price` or `min_price`.
 */
export type ProductPublicModel = Omit<
	ProductModel<string>,
	'variants' | 'attributes'
> & {
	variants?: ProductListVariantType[];
	/*
	 * Named, unlike the dashboard read's bare ids: `attachPublicAttributes` resolves both terms
	 * through `term_content` and copies the definition's quoting onto each row, because a visitor
	 * has no resolved form to look either up in.
	 */
	attributes?: ProductAttributeDisplayType[];
	/** The product's own gallery, of which `cover_image` is the first entry. */
	images?: ProductCoverImageType[];
};

/**
 * One of the product's own attributes as the public read hands it back - the stored row, its
 * label and value terms resolved into the served language, and the quoting its definition fixes.
 *
 * `unit` and `suffix` are the definition's, not the row's: a bare `330` is not a value, and
 * without them the page would have to fetch the resolved form of every category the product sits
 * in to render one line of a spec table. They are mutually exclusive - the backend's `@Check`
 * refuses a definition carrying both.
 */
export type ProductAttributeDisplayType = ProductAttributeValueType & {
	unit?: MeasureUnit | null;
	suffix?: string | null;
	attribute_label?: ProductTermRefType | null;
	attribute_value?: ProductTermRefType | null;
};

/**
 * One row of `GET /public/products`.
 *
 * `contents` holds a single translation (the listing joins one language), `variants` holds every
 * live variant rather than only the default - which is what lets a card price itself from a range
 * and, under `expanded`, become one card per variant. The editorial and scheduling columns are
 * absent: the listing only ever reaches the sellable window, so nothing is left for them to say.
 */
export type ProductListEntryType = Omit<
	ProductPublicModel,
	'workflow' | 'sale_status' | 'details' | 'deleted_at'
>;

/**
 * The product's gallery image, attached by the public endpoints only - the dashboard manages
 * images through the `image` feature instead.
 */
export type ProductCoverImageType = {
	id: number;
	path: string;
	storage: ImageStorage;
	properties: ImagePropertiesType | null;
};

/**
 * One recurring window in which the product may be ordered - a lunch menu on weekdays between
 * 12:00 and 15:00, a happy hour every evening.
 *
 * A different question from `available_from` / `available_until`, which are absolute and describe
 * the product's life in the catalog. These repeat within that life and leave `sale_status`
 * untouched: an out-of-hours product is still `available`, just not orderable right now.
 *
 * A window is a weekday and, optionally, a span of clock times - no hours at all means the whole
 * of that day. Bounding the recurrence itself - a list that runs daily but only over the summer -
 * belongs on the product's absolute dates, where it reaches `sale_status`.
 *
 * **No window at all means unrestricted** - the common case costs no rows. `day_of_week` is an ISO
 * 8601 weekday (1 = Monday … 7 = Sunday, the numbering `ISO_WEEKDAYS` carries), and null there
 * means every day. `starts_at` / `ends_at` are clock times with no date, read in the venue's
 * timezone rather than the customer's, which is why they are strings and never `Date`.
 */
export type ProductAvailabilityType = {
	day_of_week: number | null;
	/*
	 * Null in both together means all day - "available on Sundays" rather than the same rule
	 * spelled `00:00`–`23:59`. One set and one null is refused by the validator and by a check
	 * constraint on the table, because nothing could agree on what half a window means.
	 */
	starts_at: string | null;
	ends_at: string | null;
};

/**
 * What taking an optional component does to the bundle's total, in one market.
 *
 * Signed, and per currency for the same reason `ProductPriceType` is: adding 3 to a figure quoted
 * in EUR is only right if the 3 is EUR.
 *
 * The figure adjusts the **component's own** sale price, not the bundle's - which is what makes it
 * read differently from `ProductOptionPriceType`, where the delta is the whole of what the answer
 * costs because there is nothing behind the label. A 120.00 accessory at -20.00 charges 100.00.
 */
export type ProductBundleItemPriceType = {
	currency: string;
	price_delta: number | null;
};

/**
 * A choice offered inside a bundle - "choose your fries" - whose candidates are the components
 * carrying its `group_id`.
 *
 * This is the only thing that says **exactly one of these**. Two optional components are
 * independent tick boxes: the customer can take both or neither.
 *
 * No `min_select` / `max_select`, unlike `ProductOptionGroupType` - a bound counting candidate
 * rows cannot state the one case that would want it, since a bundle is measured in units and each
 * candidate carries its own `quantity` ceiling. Exactly one is the whole of what a bundle choice
 * means, and a group needs two candidates to be one at all.
 *
 * Distinct from `ProductOptionGroupType` in what a candidate is, too: an option's answer is a term
 * with a delta and nothing behind it, where a candidate here is a variant, so the choice decides
 * what leaves stock and at which VAT rate.
 */
export type ProductBundleGroupType = {
	/*
	 * The row id, unlike `ProductOptionGroupType`, which has no need of one: a bundle's
	 * components are held flat beside its groups rather than nested inside them, so this is what
	 * `ProductBundleItemType.group_id` names.
	 */
	id: number;
	label_id: number;
	position: number | null;
	/** Joined by the read, like the option group's own. */
	label?: ProductTermRefType | null;
};

/**
 * One component of a bundle: which variant, and how many.
 *
 * A component is one of three things, and the flags read against `group_id` rather than on their
 * own. With no group it is either part of the kit - the bundle's own price covers it - or
 * `is_optional`, an independent tick box. With a group it is a **candidate**, and the group
 * decides how many candidates are taken, so `is_optional` is refused there.
 *
 * Taking a component either way adds `variant.sale_price + price_delta` to the total per unit. The
 * delta is usually negative - the discount for taking the component inside the kit rather than
 * buying it alone - and it always adjusts the component's own price, candidate or not, so making a
 * candidate free means a delta of its whole price rather than zero. `is_default` preselects one,
 * and inside a group at most one.
 *
 * `quantity` is a ceiling on an optional component alone - the most the customer may take of it.
 * On a component that is always included, candidate or not, it is a plain count: a group decides
 * *which* candidate is taken, never how many of it. Nothing bounds the optional set as a whole -
 * each carries its own ceiling - which is exactly what a group adds for candidates.
 *
 * A component that is always included carries neither flag's baggage: the backend refuses a delta
 * it has nothing to adjust, and a preselect the customer cannot untick.
 *
 * The answer is a **variant**, not a product: a component is a real sellable thing that consumes
 * stock and carries its own VAT class.
 */
export type ProductBundleItemType = {
	variant_id: number;
	quantity: number;
	position: number;
	/** The group this component is a candidate for; `null` when it belongs to none. */
	group_id: number | null;
	is_optional: boolean;
	is_default: boolean;
	prices: ProductBundleItemPriceType[];
};

/**
 * A `term` reference as a product read hands it back - the id it stores, and every translation
 * the term carries. The same shape the category and tag links use, since it is the same problem:
 * a row holding an id alone cannot be drawn.
 */
export type ProductTermRefType = {
	id: number;
	contents?: { language: Language; value: string }[];
};

/**
 * What one answer does to the price, in one market. Signed, unlike `ProductPriceType` - "no
 * side, −5.00" is an answer rather than a discount - and per currency for the same reason
 * variant prices are: adding 3 to a figure quoted in EUR is only right if the 3 is EUR.
 */
export type ProductOptionPriceType = {
	currency: string;
	price_delta: number | null;
};

/**
 * One answer to the question its group asks, priced as a delta against the variant price.
 *
 * At most one answer per group carries `is_default`, the same rule the default variant follows
 * and held by the same kind of partial unique index.
 */
export type ProductOptionType = {
	label_id: number;
	position: number | null;
	is_default: boolean;
	prices: ProductOptionPriceType[];
	/** Joined by the read so the answer renders as wording rather than an id. */
	label?: ProductTermRefType | null;
};

/**
 * A question asked at order time - "choose a side", "extras" - whose answers are its `options`.
 *
 * Distinct from a variant: a variant is a different thing to sell, with its own SKU and price
 * row, while an option modifies the thing being sold by a delta. Large vs small is a variant;
 * extra bacon is an option.
 *
 * How many answers are accepted is `min_select` / `max_select` and nothing else. There is no
 * `is_required` flag and no single/multiple enum, because either would have to agree with the
 * bounds forever: required means `min_select >= 1`, single-choice means `max_select = 1`, and
 * `max_select` null means no upper bound.
 */
export type ProductOptionGroupType = {
	label_id: number;
	min_select: number | null;
	max_select: number | null;
	position: number | null;
	options: ProductOptionType[];
	/** Joined by the read, like the answers' own. */
	label?: ProductTermRefType | null;
};

export type ProductModel<D = Date | string> = {
	id: number;

	workflow: ProductWorkflow;
	sale_status: ProductSaleStatus;
	type: ProductType;
	composition: ProductComposition;
	unit: ProductUnit;
	vat_category: ProductVatCategory;

	available_from: D | null;
	available_until: D | null;
	discontinued_at: D | null;

	details: Record<string, string | number | boolean> | null;

	brand_id: number | null;

	// Timestamps
	created_at: D;
	updated_at: D;
	deleted_at: D;

	/*
	 * Relations, present only when the backend joined them - `GET /products/:id` returns all of
	 * these, `GET /products` only `contents`, `categories` and the default variant's prices.
	 * The link rows carry the referenced row's wording alongside the id so a form seeded from
	 * one shows names rather than bare ids, without a second round trip.
	 */
	contents?: ProductContentType[];
	variants?: ProductVariantType[];
	/** What the product says about itself, against the `product`-scoped definitions. */
	attributes?: ProductAttributeValueType[];
	availabilities?: ProductAvailabilityType[];
	/** `slug` comes from the public listing only, which is the surface that links a brand. */
	brand?: { id: number; name: string; slug?: string } | null;
	categories?: {
		category_id: number;
		category?: {
			id: number;
			// `slug` comes from the public read only; the dashboard's list and view omit it.
			contents?: { language: Language; label: string; slug?: string }[];
		} | null;
	}[];
	tags?: {
		tag_id: number;
		tag?: {
			id: number;
			contents?: { language: Language; value: string }[];
		} | null;
	}[];
	/**
	 * The questions asked at order time, present only on `GET /products/:id` and the public
	 * read. Both levels arrive with their label term joined - see `ProductTermRefType`.
	 */
	option_groups?: ProductOptionGroupType[];
	/*
	 * The bundle's components and the choices they may be candidates for, present only on
	 * `GET /products/:id` - the whole of what the bundle form edits. Flat and side by side, the
	 * shape the payload takes too: a component belongs to a group or to none, and one list beats
	 * two places to read it from. Each component arrives with its per-currency deltas joined and
	 * each group with its label term, unlike the variant a component names, which the editor
	 * resolves itself through `GET /product-variants`.
	 */
	bundle_groups?: ProductBundleGroupType[];
	bundle_items?: ProductBundleItemType[];
	/** Public endpoints only; `null` when the product has no gallery image. */
	cover_image?: ProductCoverImageType | null;
};

/** One selected reference as the form holds it: the id it submits, and the label it shows. */
export type ProductRefType = {
	id: number;
	label: string;
};

/**
 * Picks the wording for a linked category or tag, preferring the given language and falling
 * back to whatever translation the row carries - a link is never rendered as a bare id.
 */
function refLabel(
	contents:
		| { language: Language; label?: string; value?: string }[]
		| null
		| undefined,
	language: Language,
	fallbackId: number,
): string {
	const wanted = contents?.find((content) => content.language === language);
	const first = contents?.find((content) => content.label || content.value);

	return (
		wanted?.label ||
		wanted?.value ||
		first?.label ||
		first?.value ||
		`#${fallbackId}`
	);
}

export function toCategoryRefs(
	entry: ProductModel | undefined,
	language: Language,
): ProductRefType[] {
	return (entry?.categories ?? []).map((link) => ({
		id: link.category_id,
		label: refLabel(link.category?.contents, language, link.category_id),
	}));
}

/**
 * The product's tags as a storefront can render them: the wording the public read joined, and the
 * id the badge colors itself from.
 *
 * Its own function rather than `toTagRefs`, which is the dashboard's and falls back to `#<id>` -
 * a bare id is something an operator can act on and noise on a storefront. The read joins
 * `term_content` on the served language alone, so a tag with no wording in it arrives carrying
 * none, and there is nothing to name it by.
 */
export function toPublicTagRefs(entry: ProductPublicModel): ProductRefType[] {
	return (entry.tags ?? []).flatMap((link) => {
		const value = link.tag?.contents?.[0]?.value;

		return value ? [{ id: link.tag_id, label: value }] : [];
	});
}

export function toTagRefs(
	entry: ProductModel | undefined,
	language: Language,
): ProductRefType[] {
	return (entry?.tags ?? []).map((link) => ({
		id: link.tag_id,
		label: refLabel(link.tag?.contents, language, link.tag_id),
	}));
}

/**
 * The wording of an option group's prompt or of one of its answers.
 *
 * `fallbackId` rather than a blank: a group whose label term arrived without the read's language
 * still has to name itself in the editor, and `#12` is something an operator can act on.
 */
export function displayOptionLabel(
	label: ProductTermRefType | null | undefined,
	language: Language,
	fallbackId: number,
): string {
	return refLabel(label?.contents, language, fallbackId);
}

/**
 * The product's own label for the given language, falling back to the default language, then to
 * any content that carries one. Returns null when the row arrived without its contents.
 */
export function getProductLabel(
	product: ProductModel,
	language?: Language,
): string | null {
	if (!product.contents?.length) {
		return null;
	}

	const wanted = language
		? product.contents.find((content) => content.language === language)
		: undefined;

	const fallback =
		product.contents.find(
			(content) => content.language === Configuration.defaultLanguage(),
		) ?? product.contents.find((content) => !!content.label);

	return wanted?.label || fallback?.label || null;
}

/**
 * What a window title and a confirmation dialog call a product.
 *
 * The name comes first because a product carries no code of its own - only its variants do. It
 * falls through three steps rather than one: `getProductLabel` already tries the requested
 * language, then the default one, then any translation with a label, so reaching the slug means
 * every translation is blank and reaching the id means the row arrived with no content at all.
 * Both are edge cases, and neither may render as `undefined`.
 */
export const displayProductLabel = (entry: ProductModel) => {
	const label = getProductLabel(entry);

	if (label) {
		return label;
	}

	const slug = entry.contents?.find((content) => !!content.slug)?.slug;

	return slug ?? `#${entry.id}`;
};

/**
 * The single translation a public listing row carries. The backend joins one language, so this is
 * whatever came back rather than a lookup across languages - the same rule the product page
 * follows.
 */
export function getListContent(
	entry: ProductListEntryType,
): ProductContentType | undefined {
	return entry.contents?.[0];
}

/** `/products/<slug>`, or null for a row that arrived without its content. */
export function buildProductPath(entry: ProductListEntryType): string | null {
	const slug = getListContent(entry)?.slug;

	return slug ? Routes.get('product-view', { slug }) : null;
}

/**
 * `/products/<slug>?variant=<sku>` - how an `expanded` card addresses a variant.
 *
 * The query string rather than a path segment: a variant has no slug and no page of its own, so
 * the product page stays the canonical URL and the SKU only says which variant to open on.
 */
export function buildProductVariantPath(
	entry: ProductListEntryType,
	variant: ProductListVariantType,
): string | null {
	const path = buildProductPath(entry);

	return path ? `${path}?variant=${encodeURIComponent(variant.sku)}` : null;
}

/**
 * One axis value as words: the term's wording when it is term-backed, the literal otherwise.
 *
 * A boolean axis reads as its *label* ("Waterproof") when true and contributes nothing when
 * false - "Jacket false" is not a name. Returns null when the row carries no value the language
 * can render, so the caller drops it rather than printing a blank.
 */
function axisValueLabel(axis: ProductVariantAxisType): string | null {
	if (axis.value_term_id) {
		return axis.attribute_value?.contents?.[0]?.value ?? null;
	}

	if (axis.value_numeric !== null && axis.value_numeric !== undefined) {
		return String(axis.value_numeric);
	}

	if (axis.value_text) {
		return axis.value_text;
	}

	if (axis.value_boolean) {
		return axis.attribute_label?.contents?.[0]?.value ?? null;
	}

	return null;
}

/**
 * What a variant is called - the one thing the schema does not store.
 *
 * A variant has no label column: what tells it from its siblings is its axis values, so the name
 * is the product's label followed by those values in the order the backend resolved them (the
 * axis definition's `sort_order`). A product with a single variant and nothing to vary comes back
 * as the bare product label, which is what most of a catalog is.
 */
export function buildVariantLabel(
	entry: ProductListEntryType,
	variant: ProductListVariantType,
): string {
	const label = getListContent(entry)?.label ?? `#${entry.id}`;
	const axes = buildVariantAxisLabel(variant);

	return axes ? `${label} ${axes}` : label;
}

/**
 * Just the axis values ("512 gb", "Blue Large") - what tells this variant from its siblings,
 * without the product name.
 *
 * What a chooser on the product page wants: the heading above it already names the product, and
 * repeating it on every option is noise. A card uses `buildVariantLabel` instead, because there
 * the product name is the only thing identifying it. `null` when the variant carries no axis
 * value the language can render, which is the caller's cue to fall back to something that does.
 */
export function buildVariantAxisLabel(
	variant: ProductListVariantType,
): string | null {
	const axes = (variant.attributes ?? [])
		.map(axisValueLabel)
		.filter((value): value is string => !!value);

	return axes.length > 0 ? axes.join(' ') : null;
}

/**
 * What a spec table calls an attribute.
 *
 * Capitalised here rather than stored that way, the same as `displayAttributeLabel` in the
 * dashboard: `TermValidator` lower-cases every wording on the way in, deliberately - a term is a
 * record many products point at, and "Colour" and "colour" being two of them is exactly what that
 * avoids. Which leaves the display side to decide how it reads.
 *
 * `null` when the label term carries no wording in the served language, which is the caller's cue
 * to drop the row: a value with nothing naming it is not a spec line.
 */
export function buildAttributeLabel(
	attribute: ProductAttributeDisplayType,
): string | null {
	const value = attribute.attribute_label?.contents?.[0]?.value;

	return value ? capitalizeFirstLetter(value) : null;
}

/**
 * The attribute's value as words, quoted the way its definition fixes.
 *
 * Four value columns, exactly one of them filled - the shape a `@Check` on `product_attribute`
 * enforces - so this reads as a chain of guards rather than a switch on a discriminator the row
 * does not carry.
 *
 * A number renders with its unit's symbol, or with the definition's free-text `suffix` when it
 * names something `MeasureUnitEnum` does not cover (`pcs`, `%`); the two never appear together.
 * The figure goes through `Intl` for the request's language, so a thousand separator matches the
 * price beside it - and this is a server render, so it has to, rather than being filled in on
 * hydration.
 *
 * A boolean reads as yes/no. `buildVariantAxisLabel` renders one as its *label* instead, because
 * an axis value stands alone ("Waterproof"); here the label is already the row's key, so the
 * value has to answer the question it asks.
 *
 * `null` when nothing renders - a term with no wording in the served language, or an empty
 * literal - and the caller drops the row rather than printing a blank.
 */
export function buildAttributeValue(
	attribute: ProductAttributeDisplayType,
	language: Language,
	booleanLabels: { yes: string; no: string },
): string | null {
	if (attribute.value_term_id) {
		const value = attribute.attribute_value?.contents?.[0]?.value;

		return value ? capitalizeFirstLetter(value) : null;
	}

	if (
		attribute.value_numeric !== null &&
		attribute.value_numeric !== undefined
	) {
		const figure = new Intl.NumberFormat(language).format(
			attribute.value_numeric,
		);

		const quoting = attribute.unit
			? MEASURE_UNIT_SYMBOLS[attribute.unit]
			: attribute.suffix;

		return quoting ? `${figure} ${quoting}` : figure;
	}

	if (attribute.value_text) {
		return attribute.value_text;
	}

	if (
		attribute.value_boolean !== null &&
		attribute.value_boolean !== undefined
	) {
		return attribute.value_boolean ? booleanLabels.yes : booleanLabels.no;
	}

	return null;
}

/**
 * Every picture the product page can show, in the order it shows them: the hero first, then the
 * product's own gallery, then each variant's.
 *
 * Both galleries, because a variant's photographs are photographs *of this product* - the blue one
 * rather than the jacket - and a reader looking at the pictures wants to see them whichever row
 * they were filed against. The chooser is what selects a variant; the strip only shows what there
 * is.
 *
 * Deduped by id, which is what puts the hero at the front rather than twice: `resolveCardImage`
 * picks it out of one of these same two galleries.
 */
export function buildProductGallery(
	entry: ProductPublicModel,
	hero: ProductCoverImageType | null,
): ProductCoverImageType[] {
	const candidates = [
		...(hero ? [hero] : []),
		...(entry.images ?? []),
		...(entry.variants ?? []).flatMap((variant) => variant.images ?? []),
	];

	const seen = new Set<number>();

	return candidates.filter((image) => {
		if (seen.has(image.id)) {
			return false;
		}

		seen.add(image.id);

		return true;
	});
}

/**
 * The rows of the product page's specification table: what the product says about itself, then
 * what tells the variant on show apart from its siblings.
 *
 * One table rather than two, because a reader comparing products does not care which of two tables
 * a figure was stored in - "Color: Silver" and "Storage: 512 gb" are both specifications. The
 * product's own come first: they hold for every variant, where the axes describe only the one
 * currently selected.
 *
 * The axes are the *selected* variant's, so the table moves with the chooser the same way the
 * price does. A product with a single variant still contributes its axes, which is usually
 * nothing - a variant that varies in nothing carries no axis rows.
 */
export function buildProductSpecifications(
	entry: ProductPublicModel,
	variant: ProductListVariantType | undefined,
): ProductAttributeDisplayType[] {
	return [...(entry.attributes ?? []), ...(variant?.attributes ?? [])];
}

/**
 * The figures a product page quotes for one variant, in one currency.
 *
 * Two of them, unlike `resolvePriceRange`, which answers a span across the set and so can only
 * carry what is charged. `reference_price` is display only - the usual price a saving is measured
 * against, read by no pricing path - and it is kept only when it is *above* what is charged.
 * Below or equal it is not a saving, and a strikethrough under the sale price would read as a
 * price rise.
 *
 * Currency picked the way the range picks it, so the headline and the variant list beside it can
 * never quote two different markets.
 */
export function resolveVariantPrice(
	variant: ProductListVariantType | undefined,
): {
	currency: string;
	sale_price: number;
	reference_price: number | null;
} | null {
	const prices = variant?.prices ?? [];

	if (prices.length === 0) {
		return null;
	}

	const preferred = Configuration.get('app.currency');
	const price =
		prices.find((entry) => entry.currency === preferred) ?? prices[0];

	if (price.sale_price === null) {
		return null;
	}

	const reference = price.reference_price;

	return {
		currency: price.currency,
		sale_price: price.sale_price,
		reference_price:
			reference !== null && reference > price.sale_price
				? reference
				: null,
	};
}

/**
 * The price span across a product's variants, in one currency.
 *
 * Prefers the deployment's own currency and falls back to whatever the first variant quotes, so a
 * catalog priced only in EUR still shows a figure under a RON deployment. `min !== max` is what
 * tells a card to say "from" - the reason the listing returns every variant rather than only the
 * default one, which cannot answer the question.
 */
export function resolvePriceRange(
	variants: ProductListVariantType[] | undefined,
): { currency: string; min: number; max: number } | null {
	const prices = (variants ?? []).flatMap((variant) => variant.prices ?? []);

	if (prices.length === 0) {
		return null;
	}

	const preferred = Configuration.get('app.currency');
	const currency = prices.some((price) => price.currency === preferred)
		? preferred
		: prices[0].currency;

	const amounts = prices
		.filter((price) => price.currency === currency)
		.map((price) => price.sale_price)
		.filter((amount): amount is number => amount !== null);

	if (amounts.length === 0) {
		return null;
	}

	return {
		currency,
		min: Math.min(...amounts),
		max: Math.max(...amounts),
	};
}

/**
 * The picture a catalog card shows, which of the two galleries it comes from depending on what
 * the card stands for.
 *
 * Listing variants, the variant's own photograph is the specific one and the product's is the
 * generic fallback. Listing products, that runs the other way: the product's photograph is the
 * one chosen to represent the whole set, and a variant's is a last resort so a product shot only
 * per-variant is not rendered blank beside neighbours that have pictures.
 *
 * The default variant, not the first, supplies that last resort - it is the variant a product
 * with nothing to choose is bought through, and the one whose price the card already quotes.
 */
export function resolveCardImage(
	entry: ProductListEntryType,
	variant: ProductListVariantType | null,
): ProductCoverImageType | null {
	if (variant) {
		return variant.cover_image ?? entry.cover_image ?? null;
	}

	if (entry.cover_image) {
		return entry.cover_image;
	}

	const fallback = (entry.variants ?? []).find(
		(candidate) => candidate.is_default,
	);

	return fallback?.cover_image ?? null;
}

/**
 * Formats server-side, unlike `formatAmount` - a catalog page is rendered for a crawler, so the
 * figure has to be in the HTML rather than filled in on hydration. Safe because the language
 * comes from the request: only a *date* would pick up the container's zone.
 */
export function formatProductPrice(
	amount: number,
	currency: string,
	language: Language,
): string {
	return new Intl.NumberFormat(language, {
		style: 'currency',
		currency,
		currencyDisplay: 'narrowSymbol',
	}).format(amount);
}
