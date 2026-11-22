import { ApiRequest } from '@/helpers/api.helper';
import type {
	OrderReturnableModel,
	OrderReturnModel,
	OrderReturnReason,
	OrderReturnStatus,
} from '@/models/order-return.model';
import type { ShippingMethod } from '@/models/shipping.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Return authorizations - `../nready-api/src/features/order-return`. The dashboard half
 * (`/order-returns`) is permission-gated; the storefront half (`/public/orders/:order_id/...`)
 * needs only a session, and every call there is resolved through an order the account owns. The
 * standard CRUD goes through `services.helper.ts`; what is here are the actions it cannot express.
 */

/** Dashboard: per variant, what of an order can still be returned. */
export async function requestOrderReturnable(
	orderId: number,
): Promise<ApiResponseFetch<OrderReturnableModel>> {
	return await new ApiRequest().doFetch(
		`/order-returns/returnable/${orderId}`,
		{ method: 'GET' },
	);
}

/**
 * What approving takes. Every field is optional: the destination defaults to the warehouse the
 * goods left from, pickup to the address the delivery went to, and the return is free unless
 * `price` and `vat_rate` are stated together.
 */
export type OrderReturnApprovePayload = {
	destination_warehouse_id?: number;
	pickup_client_address_id?: number;
	carrier_id?: number;
	method?: ShippingMethod;
	price?: number;
	vat_rate?: number;
	response?: string | null;
	/** Pay the outbound delivery fee back with the goods; left out, it is not. */
	refund_shipping?: boolean;
};

/** Dashboard: approves a request and writes its return shipment (`POST /order-returns/:id/approve`). */
export async function requestApproveOrderReturn(
	id: number,
	payload: OrderReturnApprovePayload,
): Promise<ApiResponseFetch<OrderReturnModel>> {
	return await new ApiRequest().doFetch(`/order-returns/${id}/approve`, {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

/**
 * Dashboard: rejects, cancels or closes a return. Unlike the generic `requestUpdateStatus` it can
 * carry the `response` the buyer is shown - the reason for a rejection, typically.
 */
export async function requestUpdateOrderReturnStatus(
	id: number,
	status: OrderReturnStatus,
	response?: string | null,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/order-returns/${id}/status/${status}`,
		{
			method: 'PATCH',
			body: JSON.stringify(response ? { response: response } : {}),
		},
	);
}

/**
 * Dashboard: drafts the refund of a received return again - only while none is recorded. The
 * backend raises it on its own as the goods arrive; this is for when that found nothing to reverse.
 */
export async function requestOrderReturnRefund(
	id: number,
): Promise<ApiResponseFetch<{ reversal_invoice_ids: number[] }>> {
	return await new ApiRequest().doFetch(`/order-returns/${id}/refund`, {
		method: 'POST',
	});
}

/** Storefront: the returns of one of the account's own orders, oldest first. */
export async function requestOwnOrderReturns(
	orderId: number,
): Promise<ApiResponseFetch<{ entries: OrderReturnModel[] }>> {
	return await new ApiRequest().doFetch(`/public/orders/${orderId}/returns`, {
		method: 'GET',
	});
}

/** Storefront: what of an own order can still be returned, and until when. */
export async function requestOwnOrderReturnable(
	orderId: number,
): Promise<ApiResponseFetch<OrderReturnableModel>> {
	return await new ApiRequest().doFetch(
		`/public/orders/${orderId}/returnable`,
		{ method: 'GET' },
	);
}

export type OrderReturnRequestPayload = {
	reason: OrderReturnReason;
	customer_notes: string | null;
	lines: { variant_id: number; quantity: number }[];
};

/** Storefront: asks to return items of an own order. The order comes from the path only. */
export async function requestCreateOwnOrderReturn(
	orderId: number,
	payload: OrderReturnRequestPayload,
): Promise<
	ApiResponseFetch<
		Pick<OrderReturnModel, 'id' | 'ref_code' | 'ref_number' | 'status'>
	>
> {
	return await new ApiRequest().doFetch(`/public/orders/${orderId}/returns`, {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

/** Storefront: withdraws an own request while it is still undecided. */
export async function requestCancelOwnOrderReturn(
	orderId: number,
	id: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/public/orders/${orderId}/returns/${id}/cancel`,
		{ method: 'PATCH' },
	);
}
