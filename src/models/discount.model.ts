/**
 * What a discount attaches to. Mirrors the backend enum - every value except `order` implies
 * targets in the matching link table; `order` takes none and applies to the whole basket.
 * Country is not a scope: it is a condition inside `rules.applicable_countries`.
 */
export const DiscountScopeEnum = {
	CLIENT: 'client',
	ORDER: 'order',
	PRODUCT: 'product',
	VARIANT: 'variant',
	CATEGORY: 'category',
	BRAND: 'brand',
} as const;

export type DiscountScope =
	(typeof DiscountScopeEnum)[keyof typeof DiscountScopeEnum];

export const DiscountTypeEnum = {
	PERCENT: 'percent',
	AMOUNT: 'amount',
} as const;

export type DiscountType =
	(typeof DiscountTypeEnum)[keyof typeof DiscountTypeEnum];

export const DiscountReasonEnum = {
	FLASH_SALE: 'flash_sale',
	FIRST_TIME_CUSTOMER: 'first_time_customer',
	LOYALTY_DISCOUNT: 'loyalty_discount',
	BIRTHDAY_DISCOUNT: 'birthday_discount',
	REFERRAL_DISCOUNT: 'referral_discount',
	VIP_DISCOUNT: 'vip_discount',
	SPECIAL_DISCOUNT: 'special_discount',
} as const;

export type DiscountReason =
	(typeof DiscountReasonEnum)[keyof typeof DiscountReasonEnum];

/**
 * The conditions a discount is subject to; it applies only when all of them are met.
 *
 * Closed key set, mirroring the backend - an unrecognized key is rejected on write and would
 * stop the discount applying at all, so there is nothing useful to express outside this shape.
 *
 * Worth knowing when reading a cart: `hour_range`/`day_range` depend on when the question is
 * asked and `min_order_value` on a basket still being edited, so a discount offered at
 * add-to-cart can legitimately be gone by checkout.
 */
export type DiscountConditions = {
	/** Inclusive hour-of-day window, 0–23; wraps when the first value is larger. */
	hour_range?: [number, number];
	/** Inclusive ISO weekday window, Monday = 1 through Sunday = 7; wraps the same way. */
	day_range?: [number, number];
	/** Basket subtotal in the base currency, excluding VAT. */
	min_order_value?: number;
	/** ISO 3166-1 alpha-2 codes. */
	applicable_countries?: string[];
};

export type DiscountModel<D = Date | string> = {
	id: number;

	label: string;
	scope: DiscountScope;
	reason: DiscountReason;
	reference: string | null;
	type: DiscountType;
	conditions: DiscountConditions | null;
	/**
	 * A percentage when `type` is `percent`, otherwise an absolute amount in the app's base
	 * currency. The backend's `numericTransformer` converts the driver's string, so this is
	 * a number on the wire.
	 */
	value: number;
	start_at: D | null;
	end_at: D | null;
	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

/** Every scope that carries targets. `order` applies to the basket and links to nothing. */
export type DiscountTargetScope = Exclude<
	DiscountScope,
	typeof DiscountScopeEnum.ORDER
>;

/** Owner ids per scope, e.g. `{ client: [3, 9], category: [12] }`. */
export type DiscountTargetMap = Partial<Record<DiscountTargetScope, number[]>>;

export const displayDiscountLabel = (entry: DiscountModel) => {
	return entry.label;
};

/** Percent discounts read as `15%`, amount discounts as the bare number. */
export const displayDiscountValue = (entry: DiscountModel) => {
	return entry.type === DiscountTypeEnum.PERCENT
		? `${entry.value}%`
		: `${entry.value}`;
};
