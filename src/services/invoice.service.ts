import { ApiRequest } from '@/helpers/api.helper';
import type {
	InvoiceDocumentModel,
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
 * The document as it prints - the same shape the buyer's copy reads, with the order it bills and,
 * on a shipping document, the movement.
 */
export async function requestInvoiceDocument(
	id: number,
): Promise<ApiResponseFetch<InvoiceDocumentModel>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/document`, {
		method: 'GET',
	});
}

/**
 * Raise and issue the document a revenue cash flow entry is owed, then allocate the client's
 * captured money against their open documents, oldest due first.
 *
 * What the document itemizes is decided by the movement, not by this call: with an order linked,
 * the order's goods not billed yet; with none, a single line worth what the movement was worth,
 * billed to the client's billing address.
 *
 * Refused with 409 when the money is already accounted for - the linked order billed in full, or
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
 * One line of the original to take back: by `quantity` (goods returned, billable again) or by
 * `amount` (a net price correction, VAT added at the line's rate) - exactly one of the two.
 */
export type InvoiceReverseLineParams =
	| { invoice_line_id: number; quantity: number; amount?: never }
	| { invoice_line_id: number; amount: number; quantity?: never };

/**
 * Raise an empty custom invoice for a client: a document built by hand, with no order behind it.
 * Its lines, parties, due date and notes are written afterwards through the same `update` any draft
 * takes; the buyer starts from the client's billing address when there is one.
 */
export async function requestInvoiceCustomCreate(params: {
	client_id: number;
}): Promise<ApiResponseFetch<Partial<InvoiceModel>>> {
	return await new ApiRequest().doFetch('/invoices/custom', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Raise a reversal (storno) against an issued document. It comes back as a draft of the same scope,
 * flagged `is_reversal`, and is numbered from the invoice series when it is issued in turn.
 *
 * `lines` takes back part of the original - each line within what earlier reversals left on it;
 * omitted, everything not reversed yet.
 */
export async function requestInvoiceReverse(
	id: number,
	params: {
		notes?: string | null;
		lines?: InvoiceReverseLineParams[];
	} = {},
): Promise<ApiResponseFetch<Partial<InvoiceModel>>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/reverse`, {
		method: 'POST',
		body: JSON.stringify({
			...(params.notes ? { notes: params.notes } : {}),
			...(params.lines ? { lines: params.lines } : {}),
		}),
	});
}

/**
 * Settle part or all of an issued document against a cash movement.
 *
 * `amount` is **gross**, in the invoice currency and its two decimals - not the net, scaled figure
 * the movement itself stores. The API refuses an amount past what is left of that movement after
 * its other allocations, a movement in another currency, and one whose direction does not match
 * the document (money in settles an invoice, money out settles a reversal).
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

/**
 * Take every payment off an issued invoice, handing the money back to the client's movements for
 * an operator to allocate elsewhere. Refused on a reversal and on an invoice with an issued
 * reversal.
 */
export async function requestInvoicePaymentClear(
	id: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/invoices/${id}/payments`, {
		method: 'DELETE',
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
