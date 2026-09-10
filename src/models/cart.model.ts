import type { StatusTransitions } from '@/types/common.type';

/**
 * Mirrors `cart` and `cart_item` in the backend.
 *
 * **Nothing under `pricing` is stored** - a cart holds references and is repriced from the catalog
 * on every read. Do not cache it, do not persist it between visits, and do not compute a total
 * from a figure the page was handed earlier - re-read the cart instead.
 */

/**
 * The cart's lifecycle. `converted` and `abandoned` are both terminal: a shopper returning after
 * either is given a new cart, never the old one back.
 */
export const CartStatusEnum = {
	ACTIVE: 'active',
	CONVERTED: 'converted',
	ABANDONED: 'abandoned',
} as const;

export type CartStatus = (typeof CartStatusEnum)[keyof typeof CartStatusEnum];

/** Mirrors `STATUS_TRANSITIONS` on the entity. Nothing leaves a terminal state. */
export const CART_STATUS_TRANSITIONS: StatusTransitions<CartStatus> = {
	[CartStatusEnum.ACTIVE]: [
		CartStatusEnum.CONVERTED,
		CartStatusEnum.ABANDONED,
	],
	[CartStatusEnum.CONVERTED]: [],
	[CartStatusEnum.ABANDONED]: [],
};

/**
 * Why a line cannot be bought as it stands. The line is still returned - a shopper has to see what
 * dropped out and why - but it contributes nothing to the totals and blocks checkout.
 */
export const CartLineIssueEnum = {
	VARIANT_GONE: 'variant_gone',
	NOT_SELLABLE: 'not_sellable',
	NO_PRICE: 'no_price',
	OPTION_GONE: 'option_gone',
} as const;

export type CartLineIssue =
	(typeof CartLineIssueEnum)[keyof typeof CartLineIssueEnum];

/** What each chosen option did to the line price, in the cart's currency. */
export type CartOptionSnapshot = {
	label: string;
	price_delta: number;
	currency: string;
};

/** The discount that won this line, as the backend recorded it. Null when none applied. */
export type CartDiscountSnapshot = {
	label: string;
	scope: string;
	reason: string | null;
	reference: string | null;
	type: string;
	value: number;
};

/** One priced line. Every money field is computed at read time and stored nowhere. */
export type CartLineModel = {
	id: number;
	variant_id: number;
	product_id: number;
	sku: string | null;
	quantity: number;
	notes: string | null;

	/** Unit price excluding VAT, options already folded in. */
	unit_price: number;
	/** The catalog price before the options moved it, for showing the delta. */
	base_price: number;
	options: CartOptionSnapshot[];

	vat_rate: number;
	/** `unit_price × quantity`, excluding VAT and before any discount. */
	subtotal: number;
	discount_reduction: number;
	discount: CartDiscountSnapshot | null;
	/** `subtotal - discount_reduction`, excluding VAT. */
	total: number;
	vat_amount: number;

	issue: CartLineIssue | null;
};

export type CartPricingModel = {
	currency: string;
	exchange_rate: number;
	lines: CartLineModel[];
	subtotal: number;
	discount_reduction: number;
	vat_amount: number;
	/** What the shopper would pay, VAT included. */
	total: number;
	/** True while any line carries an `issue`; checkout is refused until they are resolved. */
	has_issues: boolean;
};

/**
 * A cart row.
 *
 * `pricing` is **optional on purpose**, and the split is the backend's: its dashboard listing
 * selects the columns only, while every storefront endpoint and the dashboard's single-row read
 * resolve the lines as well. Pricing a whole page of carts would mean re-reading the catalog once
 * per row, so the listing does not - and a table cell must not assume the figures are there.
 *
 * Use `CartWithPricingModel` wherever they are guaranteed.
 */
export type CartModel = {
	id: number;
	/**
	 * The guest handle. Held server-side as an httpOnly cookie and attached by the proxy, so a
	 * browser-side caller never has to read or store it - it is here because the backend returns
	 * it, not because the client is expected to keep it.
	 *
	 * **Not a filter on the dashboard listing, deliberately.** It is the guest's whole credential,
	 * and a back-office search by it would turn a support screen into a way to open any cart.
	 */
	token: string;
	status: CartStatus;
	currency: string;
	user_id: number | null;
	order_id: number | null;
	expires_at: string;
	created_at: string;
	updated_at: string | null;
	deleted_at: string | null;
	pricing?: CartPricingModel;
};

/** A cart whose lines have been priced - every storefront response, and the dashboard read. */
export type CartWithPricingModel = CartModel & { pricing: CartPricingModel };

/**
 * How a cart is named in a window title or a confirmation. There is nothing human on the row - no
 * label, no reference - so the id is the honest answer, and the token is never shown.
 */
export function displayCartLabel(entry: CartModel): string {
	return `#${entry.id}`;
}

/**
 * Who is carrying it. A guest cart names nobody, which is the ordinary case rather than missing
 * data - the whole point of the feature is that a basket exists before anyone signs in.
 */
export function displayCartOwner(entry: CartModel): string {
	return entry.user_id ? `User #${entry.user_id}` : 'Guest';
}

/** Line count and total, for a listing cell. Both are absent until the cart has been priced. */
export function displayCartTotal(entry: CartModel): string {
	if (!entry.pricing) {
		return '-';
	}

	return `${entry.pricing.total.toFixed(2)} ${entry.currency}`;
}

/** What checkout answers with. The cart is terminal at that point, so no basket comes back. */
export type CartCheckoutModel = {
	order_id: number;
	ref_code: string;
	ref_number: number;
	status: string;
	issued_at: string;
};

/** The payload for adding a line. `product_id` must be the variant's own - the backend refuses a mismatch. */
export type CartAddItemParams = {
	variant_id: number;
	product_id: number;
	quantity: number;
	options?: number[];
	notes?: string;
};
