import { ApiRequest } from '@/helpers/api.helper';
import type {
	CartAddItemParams,
	CartCheckoutModel,
	CartWithPricingModel,
} from '@/models/cart.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The storefront cart endpoints (`/public/cart`).
 *
 * A caller has exactly one cart and never names it: a guest is identified by the `cart_token`
 * cookie the proxy holds and attaches, a signed-in shopper by their session. So none of these
 * functions takes a cart id, and there is no way for one browser to address another's basket.
 *
 * All of them go through `/api/proxy` (the default request mode) - both credentials live on that
 * side of the hop, out of reach of anything running in the page.
 *
 * **Nothing here is cacheable.** The prices come back resolved against the catalog at the moment
 * of the call and are stored nowhere, which is the whole point of the cart/order split: a basket
 * open for three weeks quotes today's price. Re-read rather than reuse a total the page already
 * has, and let every write's response replace the cart wholesale - the totals move on any change,
 * since a discount conditioned on the basket value can switch on when one line is added.
 */

/**
 * The current cart, created when the caller has none - so a first page load needs no separate
 * "start a cart" call and the badge in the header can call this unconditionally.
 */
export async function requestCart(): Promise<
	ApiResponseFetch<CartWithPricingModel>
> {
	return await new ApiRequest().doFetch('/public/cart', { method: 'GET' });
}

/**
 * Adds a line. Re-adding the same variant with the same options raises the quantity of the line
 * already holding it rather than creating a second one; the option ids are sorted and
 * de-duplicated by the backend, so the order they are sent in does not matter. A different option
 * set is a genuinely different line.
 */
export async function requestAddCartItem(
	params: CartAddItemParams,
): Promise<ApiResponseFetch<CartWithPricingModel>> {
	return await new ApiRequest().doFetch('/public/cart/items', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Changes a line's quantity or note. The options are not editable - a different option set is a
 * different line - so a change of options is a remove followed by an add.
 */
export async function requestUpdateCartItem(
	itemId: number,
	params: { quantity?: number; notes?: string },
): Promise<ApiResponseFetch<CartWithPricingModel>> {
	return await new ApiRequest().doFetch(`/public/cart/items/${itemId}`, {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}

/** Removes a line outright - what a shopper took out of a basket is not a record anybody keeps. */
export async function requestRemoveCartItem(
	itemId: number,
): Promise<ApiResponseFetch<CartWithPricingModel>> {
	return await new ApiRequest().doFetch(`/public/cart/items/${itemId}`, {
		method: 'DELETE',
	});
}

/** Empties the cart. Succeeds on an already-empty one, and the cart itself survives. */
export async function requestClearCart(): Promise<
	ApiResponseFetch<CartWithPricingModel>
> {
	return await new ApiRequest().doFetch('/public/cart', { method: 'DELETE' });
}

/**
 * Reprices the whole basket into another market. One column changes on the backend, because no
 * line stores money.
 *
 * A currency the catalog carries no price in is not refused: the affected lines come back with
 * `issue: 'no_price'`, which tells the shopper more than a rejected request would.
 */
export async function requestSetCartCurrency(
	currency: string,
): Promise<ApiResponseFetch<CartWithPricingModel>> {
	return await new ApiRequest().doFetch('/public/cart/currency', {
		method: 'PATCH',
		body: JSON.stringify({ currency }),
	});
}

/**
 * Turns the cart into an order. Requires a session - the order names a `client` to invoice, which
 * cannot be chosen for an anonymous caller.
 *
 * Prices are resolved once more on the backend rather than reused from whatever the shopper was
 * last shown, and those are the figures written to the order: this is the moment they stop moving.
 * An empty cart answers 400, and so does a cart with any line carrying an `issue` - check
 * `pricing.has_issues` before offering the button.
 *
 * The cart is terminal afterwards, so the next `requestCart` starts a new one.
 */
export async function requestCartCheckout(params: {
	client_id: number;
	notes?: string;
}): Promise<ApiResponseFetch<CartCheckoutModel>> {
	return await new ApiRequest().doFetch('/public/cart/checkout', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}
