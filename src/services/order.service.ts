import { ApiRequest, buildQueryString } from '@/helpers/api.helper';
import type {
	OrderModel,
	OrderStatus,
	OrderTotalsModel,
} from '@/models/order.model';
import type { OrderShipmentModel } from '@/models/shipping.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The signed-in account's own orders (`/public/orders`) - every order billed to one of its clients.
 * All three calls need a session: the backend scopes each read by the account behind the request,
 * and somebody else's order answers 404, the same as a missing one. They go through `/api/proxy`
 * (the default request mode) so the backend reads the account from the session the proxy attaches.
 */

/** Prefix of every account-order query, so a checkout can drop the whole family at once. */
export const OWN_ORDERS_QUERY_KEY = ['order', 'own'] as const;

/** A listing row: the order and its client, with the totals attached but no lines. */
export type OwnOrderListEntry = OrderModel & { totals: OrderTotalsModel };

export type OwnOrdersParams = {
	page: number;
	limit: number;
	status?: OrderStatus | null;
};

export async function requestOwnOrders(
	params: OwnOrdersParams,
): Promise<ApiResponseFetch<FindFunctionResponseType<OwnOrderListEntry>>> {
	const query = buildQueryString({
		page: params.page,
		limit: params.limit,
		filter: { status: params.status },
	});

	return await new ApiRequest().doFetch(`/public/orders?${query}`, {
		method: 'GET',
	});
}

/** The detail read: the order with its lines and totals, both always present on this endpoint. */
export type OwnOrderDetail = OrderModel &
	Required<Pick<OrderModel, 'lines' | 'totals'>>;

/** One order with its lines and totals. */
export async function requestOwnOrder(
	id: number,
): Promise<ApiResponseFetch<OwnOrderDetail>> {
	return await new ApiRequest().doFetch(`/public/orders/${id}`, {
		method: 'GET',
	});
}

/** The deliveries and returns against one of the account's orders, oldest first. */
export async function requestOwnOrderShipments(
	id: number,
): Promise<ApiResponseFetch<{ entries: OrderShipmentModel[] }>> {
	return await new ApiRequest().doFetch(`/public/orders/${id}/shipments`, {
		method: 'GET',
	});
}
