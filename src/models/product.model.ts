import { Configuration } from '@/config/settings.config';
import type { ImageStorage } from '@/models/image.model';
import type { ProductAttributeValueType } from '@/models/product-category-attribute.model';
import type { Language, StatusTransitions } from '@/types/common.type';
import type { ImagePropertiesType } from '@/types/image.type';
import type { PageMeta } from '@/types/page-meta.type';

/**
 * The editorial state a product moves through, changed only via
 * `PATCH /products/:id/workflow/:workflow` — never as a field on the manage form, because the
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

// Mirrors WORKFLOW_TRANSITIONS in the backend entity. `ready` is terminal — nothing leads out
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
 * `available_until` and `discontinued_at`. It is display-and-filter only here — the timestamps
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
 * its own `vat_category` is unused — the components carry both.
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
 * Mirrored by a rule in the backend validator — this map is what the form offers, not what the
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
 * `min_price` above `sale_price`. `reference_price` is display only — the usual price a saving is
 * measured against, never charged and read by no pricing path.
 */
export type ProductPriceType = {
	currency: string;
	sale_price: number | null;
	reference_price: number | null;
	min_price: number | null;
};

/**
 * The sellable unit — price and stock hang here, not on the product. Exactly one variant of a
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
	 * Absent leaves the stored ones alone on a save; `[]` clears them — the same split the
	 * product-level list carries, and the reason neither is defaulted.
	 */
	attributes?: ProductAttributeValueType[];
};

/**
 * The product's gallery image, attached by the public endpoints only — the dashboard manages
 * images through the `image` feature instead.
 */
export type ProductCoverImageType = {
	id: number;
	path: string;
	storage: ImageStorage;
	properties: ImagePropertiesType | null;
};

/**
 * One recurring window in which the product may be ordered — a lunch menu on weekdays between
 * 12:00 and 15:00, a happy hour every evening.
 *
 * A different question from `available_from` / `available_until`, which are absolute and describe
 * the product's life in the catalog. These repeat within that life and leave `sale_status`
 * untouched: an out-of-hours product is still `available`, just not orderable right now.
 *
 * A window is a weekday and, optionally, a span of clock times — no hours at all means the whole
 * of that day. Bounding the recurrence itself — a list that runs daily but only over the summer —
 * belongs on the product's absolute dates, where it reaches `sale_status`.
 *
 * **No window at all means unrestricted** — the common case costs no rows. `day_of_week` is an ISO
 * 8601 weekday (1 = Monday … 7 = Sunday, the numbering `ISO_WEEKDAYS` carries), and null there
 * means every day. `starts_at` / `ends_at` are clock times with no date, read in the venue's
 * timezone rather than the customer's, which is why they are strings and never `Date`.
 */
export type ProductAvailabilityType = {
	day_of_week: number | null;
	/*
	 * Null in both together means all day — "available on Sundays" rather than the same rule
	 * spelled `00:00`–`23:59`. One set and one null is refused by the validator and by a check
	 * constraint on the table, because nothing could agree on what half a window means.
	 */
	starts_at: string | null;
	ends_at: string | null;
};

/**
 * One component of a bundle: which variant, and how many. Every component is always included —
 * a bundle is a flat list, with nothing for the customer to choose between.
 *
 * The answer is a **variant**, not a product: a component is a real sellable thing that consumes
 * stock and carries its own VAT class.
 */
export type ProductBundleItemType = {
	variant_id: number;
	quantity: number;
	position: number;
};

/**
 * A `term` reference as a product read hands it back — the id it stores, and every translation
 * the term carries. The same shape the category and tag links use, since it is the same problem:
 * a row holding an id alone cannot be drawn.
 */
export type ProductTermRefType = {
	id: number;
	contents?: { language: Language; value: string }[];
};

/**
 * What one answer does to the price, in one market. Signed, unlike `ProductPriceType` — "no
 * side, −5.00" is an answer rather than a discount — and per currency for the same reason
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
 * A question asked at order time — "choose a side", "extras" — whose answers are its `options`.
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
	 * Relations, present only when the backend joined them — `GET /products/:id` returns all of
	 * these, `GET /products` only `contents`, `categories` and the default variant's prices.
	 * The link rows carry the referenced row's wording alongside the id so a form seeded from
	 * one shows names rather than bare ids, without a second round trip.
	 */
	contents?: ProductContentType[];
	variants?: ProductVariantType[];
	/** What the product says about itself, against the `product`-scoped definitions. */
	attributes?: ProductAttributeValueType[];
	availabilities?: ProductAvailabilityType[];
	brand?: { id: number; name: string } | null;
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
	 * read. Both levels arrive with their label term joined — see `ProductTermRefType`.
	 */
	option_groups?: ProductOptionGroupType[];
	/*
	 * The bundle's components, present only on `GET /products/:id` — the whole of what the
	 * bundle form edits.
	 */
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
 * back to whatever translation the row carries — a link is never rendered as a bare id.
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
 * The name comes first because a product carries no code of its own — only its variants do. It
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
