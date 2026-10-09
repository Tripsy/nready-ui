import { ApiRequest, buildQueryString } from '@/helpers/api.helper';
import type {
	CashFlowDirection,
	CashFlowMethod,
	CashFlowStatus,
} from '@/models/cash-flow.model';
import type {
	InvoicePaymentStatus,
	InvoiceScope,
	InvoiceStatus,
} from '@/models/invoice.model';
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
/**
 * `awaiting_payment` is not a status: it marks a pending order paid by card or transfer whose
 * payment is still open, which the storefront shows in place of "pending".
 */
export type OwnOrderListEntry = OrderModel & {
	totals: OrderTotalsModel;
	awaiting_payment: boolean;
};

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
	Required<Pick<OrderModel, 'lines' | 'totals'>> & {
		/** See `OwnOrderListEntry`. */
		awaiting_payment: boolean;
	};

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

/**
 * One document billing an order, as its buyer is shown it - issued only. A reversal (credit note)
 * names its original in `parent_invoice_id`; its figures stay positive and the flag carries the
 * sign.
 */
export type OwnOrderInvoice = {
	id: number;
	ref_code: string | null;
	ref_number: number | null;
	status: InvoiceStatus;
	payment_status: InvoicePaymentStatus;
	scope: InvoiceScope;
	is_reversal: boolean;
	parent_invoice_id: number | null;
	currency: string;
	total_net: number;
	total_vat: number;
	total_gross: number;
	issued_at: string | null;
	due_at: string | null;
	paid_at: string | null;
};

/** One movement of money filed under an order. A refund is `direction` `out`; `gross_amount` is unsigned. */
export type OwnOrderPayment = {
	id: number;
	direction: CashFlowDirection;
	method: CashFlowMethod;
	status: CashFlowStatus;
	gross_amount: number;
	currency: string;
	created_at: string;
	updated_at: string | null;
};

/** The invoices and payments of one of the account's orders, oldest first. */
export async function requestOwnOrderBilling(id: number): Promise<
	ApiResponseFetch<{
		invoices: OwnOrderInvoice[];
		payments: OwnOrderPayment[];
	}>
> {
	return await new ApiRequest().doFetch(`/public/orders/${id}/billing`, {
		method: 'GET',
	});
}

/**
 * The deliveries and returns against several of the account's orders - one page of the history -
 * in one request. An id the account does not own simply has no entries; group by `order_id`.
 */
export async function requestOwnOrdersShipments(
	orderIds: readonly number[],
): Promise<ApiResponseFetch<{ entries: OrderShipmentModel[] }>> {
	const query = buildQueryString({ order_id: [...orderIds] });

	return await new ApiRequest().doFetch(`/public/shipments?${query}`, {
		method: 'GET',
	});
}

/**
 * Withdraws one of the account's pending orders, with its pending payment request and the
 * deliveries that have not left. Answers 409 - with a message saying why - once the order is no
 * longer pending, has been invoiced or has a payment under way.
 */
export async function requestCancelOwnOrder(
	id: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/public/orders/${id}/cancel`, {
		method: 'PATCH',
	});
}
