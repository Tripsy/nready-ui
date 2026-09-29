import { ApiRequest } from '@/helpers/api.helper';
import type {
	InvoiceLineModel,
	InvoiceModel,
	InvoicePaymentModel,
} from '@/models/invoice.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The invoice endpoints that hang off a document rather than off the collection, which the
 * generic `services.helper` requests cannot address. Issuing and canceling are not here: both are
 * plain status transitions and go through `requestUpdateStatus`.
 */

/**
 * Raise and issue the charge a revenue cash flow entry is owed a document for, then allocate that
 * same movement against it.
 *
 * What the document itemizes is decided by the movement, not by this call: with an order linked,
 * the order's own lines and its shipping; with none, a single line worth what the movement was
 * worth, billed to the client's billing address. A movement not yet captured leaves the document
 * unpaid for the capture to settle.
 *
 * Refused with 409 when the money is already accounted for - a live charge on the linked order, or
 * an allocation already made against a movement with no order.
 */
export async function requestInvoiceRaiseForCashFlow(
	cashFlowId: number,
): Promise<ApiResponseFetch<Partial<InvoiceModel>>> {
	return await new ApiRequest().doFetch(
		`/invoices/from-cash-flow/${cashFlowId}`,
		{ method: 'POST' },
	);
}

/**
 * Raise a credit note against an issued charge. It comes back as a draft of its own, mirroring
 * the parent lines, and is numbered from the credit note series when it is issued in turn.
 */
export async function requestInvoiceCreditNote(
	id: number,
	notes?: string | null,
): Promise<ApiResponseFetch<Partial<InvoiceModel>>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/credit-note`, {
		method: 'POST',
		body: JSON.stringify(notes ? { notes } : {}),
	});
}

/**
 * Add an adjustment line - rounding, a manual correction, anything with no source row. The API
 * refuses any other kind here and refuses the write outright once the document has left `draft`.
 */
export async function requestInvoiceLineCreate(
	id: number,
	params: {
		label: string;
		quantity: number;
		unit_price: number;
		vat_rate: number;
		discount_reduction?: number | null;
		notes?: string | null;
	},
): Promise<ApiResponseFetch<Partial<InvoiceLineModel>>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/lines`, {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Restate an adjustment or a generated line while the document is still a draft. The API
 * recomputes the line's net, VAT and total from whatever it reads after the patch, and re-sums the
 * invoice totals with it - none of those three figures is ever sent.
 */
export async function requestInvoiceLineUpdate(
	id: number,
	lineId: number,
	params: {
		label?: string | null;
		quantity?: number | null;
		unit_price?: number | null;
		vat_rate?: number | null;
		discount_reduction?: number | null;
		notes?: string | null;
	},
): Promise<ApiResponseFetch<Partial<InvoiceLineModel>>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/lines/${lineId}`, {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}

export async function requestInvoiceLineDelete(
	id: number,
	lineId: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/lines/${lineId}`, {
		method: 'DELETE',
	});
}

/**
 * Settle part or all of an issued document against a cash movement.
 *
 * `amount` is **gross**, in the invoice currency and its two decimals - not the net, scaled figure
 * the movement itself stores. The API refuses an amount past what is left of that movement after
 * its other allocations, a movement in another currency, and one whose direction does not match
 * the document (money in settles a charge, money out settles a credit note).
 */
export async function requestInvoicePaymentCreate(
	id: number,
	params: {
		cash_flow_id: number;
		amount: number;
		notes?: string | null;
	},
): Promise<ApiResponseFetch<Partial<InvoicePaymentModel>>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/payments`, {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestInvoicePaymentDelete(
	id: number,
	paymentId: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/invoices/${id}/payments/${paymentId}`,
		{
			method: 'DELETE',
		},
	);
}
