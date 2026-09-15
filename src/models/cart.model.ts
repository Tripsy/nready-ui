import Routes from '@/config/routes.setup';
import type { OrderPaymentMethod, ShippingMethod } from '@/models/order.model';
import { roundMoney } from '@/models/product.model';

/**
 * Mirrors `cart` and `cart_item` in the backend.
 *
 * **Nothing under `pricing` is stored** - a cart holds references and is repriced from the catalog
 * on every read. Do not cache it, do not persist it between visits, and do not compute a total
 * from a figure the page was handed earlier - re-read the cart instead.
 *
 * **A cart has no status and no soft delete.** It exists while somebody is filling it and is
 * deleted the moment it stops being that - checked out, folded into an account's own at sign-in,
 * or left untouched past `expires_at`. So every cart the API returns is a live basket, and a
 * handle that no longer resolves gets a fresh cart rather than an old one in some final state.
 */

/**
 * Why a line cannot be bought as it stands. The line is still returned - a shopper has to see what
 * dropped out and why - but it contributes nothing to the totals and blocks checkout.
 */
export const CartLineIssueEnum = {
	VARIANT_GONE: 'variant_gone',
	NOT_SELLABLE: 'not_sellable',
	NO_PRICE: 'no_price',
	OPTION_GONE: 'option_gone',
	/** The options no longer answer the product's questions within their bounds. */
	OPTION_SELECTION: 'option_selection',
	/** The bundle's composition moved under the line - it has to be removed and added again. */
	BUNDLE_CHANGED: 'bundle_changed',
} as const;

export type CartLineIssue =
	(typeof CartLineIssueEnum)[keyof typeof CartLineIssueEnum];

/** What each chosen option did to the line price, in the cart's currency. */
export type CartOptionSnapshot = {
	option_id?: number;
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

/**
 * One priced line. Every money field is computed at read time and stored nowhere.
 *
 * A bundle arrives as a header line plus one line per component, mirroring what the order records
 * (`product.md` §8.3). **The header carries no money** - `unit_price` and `subtotal` are zero on
 * it and its components hold the bundle's whole price between them, each at its own VAT rate - so
 * summing every line is correct and must not be special-cased. `base_price` on the header is what
 * one bundle costs, for display only.
 */
/**
 * Where a cart line's name links to: its product page, opened on the variant in the basket so
 * the page shows what was added. A bundle's page has a single variant, so its header needs no
 * `?variant=`. `null` when the product has no slug in the served language - the name renders as
 * plain text rather than as a link to nothing.
 */
export function cartLineHref(
	line: Pick<CartLineModel, 'slug' | 'sku' | 'is_bundle'>,
): string | null {
	if (!line.slug) {
		return null;
	}

	const path = Routes.get('product-view', { slug: line.slug });

	return line.sku && !line.is_bundle
		? `${path}?variant=${encodeURIComponent(line.sku)}`
		: path;
}

export type CartLineModel = {
	id: number;
	/** The bundle line this one belongs to; null on every line the shopper added directly. */
	parent_id: number | null;
	/** Which `product_bundle_item` this line materializes; null unless it is a component. */
	bundle_item_id: number | null;
	/** True on a bundle header, so the components below it can be rendered as its contents. */
	is_bundle: boolean;
	variant_id: number;
	product_id: number;
	sku: string | null;
	/** The product's name in the served content language; null when it has none there. */
	label: string | null;
	/** The product's slug in the same language, for linking the line to its page; null when it has none. */
	slug: string | null;
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
	currency: string;
	user_id: number | null;
	expires_at: string;
	created_at: string;
	updated_at: string | null;
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

/** The product's name, then its SKU - a line whose product lost its translation still says something. */
export function displayCartLineName(line: CartLineModel): string {
	return line.label ?? line.sku ?? `#${line.variant_id}`;
}

/**
 * A bundle's component lines keyed by their header's id, in the order the backend returned them.
 * Top-level lines are not in the map - they are the ones with `parent_id === null`.
 */
export function groupCartComponents(
	lines: readonly CartLineModel[],
): Map<number, CartLineModel[]> {
	const componentsByParent = new Map<number, CartLineModel[]>();

	for (const line of lines) {
		if (line.parent_id === null) {
			continue;
		}

		const list = componentsByParent.get(line.parent_id) ?? [];

		list.push(line);
		componentsByParent.set(line.parent_id, list);
	}

	return componentsByParent;
}

/**
 * What a line costs, VAT-inclusive and after its discount - the figure the basket and the checkout
 * summary both show.
 *
 * A bundle header carries no money: its components hold the whole price, each at its own VAT rate,
 * so a bundle's figure is summed from them. The header's own zero would read as a free menu.
 */
export function getCartLineGrossTotal(
	line: CartLineModel,
	components: readonly CartLineModel[],
): number {
	if (line.is_bundle) {
		return roundMoney(
			components.reduce(
				(sum, component) =>
					sum + component.total + component.vat_amount,
				0,
			),
		);
	}

	return roundMoney(line.total + line.vat_amount);
}

/**
 * What the discounts took off, VAT-inclusive - the "Discount" row of a summary. The reduction is
 * stored net and VAT is charged after it, so each line's is grossed up at that line's own rate.
 */
export function getCartDiscountGross(lines: readonly CartLineModel[]): number {
	return roundMoney(
		lines.reduce(
			(sum, line) =>
				sum +
				roundMoney(line.discount_reduction * (1 + line.vat_rate / 100)),
			0,
		),
	);
}

/**
 * A line's unit price before its discount, VAT-inclusive. A bundle has no unit price of its own,
 * so its figure is its total divided by the quantity.
 */
export function getCartLineGrossUnitPrice(
	line: CartLineModel,
	lineTotal: number,
): number {
	if (line.is_bundle) {
		return line.quantity > 0 ? roundMoney(lineTotal / line.quantity) : 0;
	}

	return roundMoney(line.unit_price * (1 + line.vat_rate / 100));
}

/**
 * The checkout payload. Both addresses are client addresses filed under `client_id`: billing
 * always, delivery for a courier only. The backend copies the billing one onto the order and the
 * delivery one onto its first shipment.
 */
export type CartCheckoutParams = {
	client_id: number;
	billing_address_id: number;
	delivery_method: ShippingMethod;
	delivery_address_id?: number | null;
	payment_method: OrderPaymentMethod;
	notes?: string | null;
};

/** What checkout answers with. The cart is deleted at that point, so no basket comes back. */
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
	/**
	 * What was chosen inside a bundle: the `product_bundle_item` rows ticked or picked, and for a
	 * tick box how many units of it.
	 *
	 * **Only the decisions.** Components that always come with the kit are not sent - the backend
	 * resolves those from the catalog, and naming one is refused. `units` is omitted on a group
	 * candidate, whose own quantity says what the bundle contains once it is the one chosen.
	 *
	 * Accepted only on a bundle, and required when the bundle has choices to make.
	 */
	components?: { item_id: number; units?: number }[];
	notes?: string;
};
