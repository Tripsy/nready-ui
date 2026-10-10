import type { OrderModel } from '@/models/order.model';
import { roundMoney } from '@/models/product.model';
import type {
	ShippingAddressSnapshot,
	ShippingMethod,
	ShippingScope,
} from '@/models/shipping.model';
import type { Currency, StatusTransitions } from '@/types/common.type';

export const InvoiceStatusEnum = {
	DRAFT: 'draft', // Being assembled, holds no number yet, still editable
	ISSUED: 'issued', // Number allocated, document frozen
	CANCELED: 'canceled', // Invalidated before it was ever settled
} as const;

export type InvoiceStatus =
	(typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

/**
 * A document moves one way only, and `canceled` is terminal; an issued document is taken back
 * by a reversal, not by a way back up this list. Mirrors
 * `STATUS_TRANSITIONS` in the API's `invoice.entity.ts` - the backend refuses anything else.
 */
export const STATUS_TRANSITIONS: StatusTransitions<InvoiceStatus> = {
	[InvoiceStatusEnum.DRAFT]: [
		InvoiceStatusEnum.ISSUED,
		InvoiceStatusEnum.CANCELED,
	],

	// An issued invoice is taken back only by a reversal, never canceled
	[InvoiceStatusEnum.ISSUED]: [],

	[InvoiceStatusEnum.CANCELED]: [],
};

/** Only a draft may be changed, deleted, or have its lines edited. */
export const MUTABLE_STATUSES = [InvoiceStatusEnum.DRAFT];

/**
 * How far the document has been settled, summed from its payment allocations by the API. Read
 * only: nothing here sets it, it moves when an allocation is written or removed.
 */
export const InvoicePaymentStatusEnum = {
	UNPAID: 'unpaid',
	PARTIAL: 'partial', // Allocated, but short of the total
	PAID: 'paid',
} as const;

export type InvoicePaymentStatus =
	(typeof InvoicePaymentStatusEnum)[keyof typeof InvoicePaymentStatusEnum];

/**
 * What a document bills, which decides how it reads. Mirrors `InvoiceScopeEnum` in the API's
 * `invoice.entity.ts`.
 *
 * - `order` - an order's goods; an order may carry several (partial shipments, goods and
 *   services billed apart, a corrected document after a reversal).
 * - `shipping` - one movement of goods, billed for its fee.
 * - `subscription` - a subscription period, itemized by hand.
 * - `custom` - built by hand for a client, with no order behind it: a one-off service, a charge
 *   agreed off-system. Its lines are `adjustment` lines.
 *
 * A reversal (storno) is not a scope: it carries `is_reversal` and the scope of the document it
 * reverses, and every invoice - reversals included - is numbered from the invoice series.
 */
export const InvoiceScopeEnum = {
	ORDER: 'order',
	SHIPPING: 'shipping',
	SUBSCRIPTION: 'subscription',
	CUSTOM: 'custom',
} as const;

export type InvoiceScope =
	(typeof InvoiceScopeEnum)[keyof typeof InvoiceScopeEnum];

/**
 * What a line bills for. Only `adjustment` can be added by hand - a `product` or `shipping` line
 * names the row it was raised from, and those are generated from the order.
 */
export const InvoiceLineKindEnum = {
	PRODUCT: 'product',
	SHIPPING: 'shipping',
	ADJUSTMENT: 'adjustment',
} as const;

export type InvoiceLineKind =
	(typeof InvoiceLineKindEnum)[keyof typeof InvoiceLineKindEnum];

/**
 * A party as the document froze it, the moment it was issued. Written once and never refreshed:
 * the client may move office or change bank afterwards, and a document already handed to a buyer
 * has to keep showing what it showed on the day.
 */
export type PartyDetails = {
	address_country: string;
	address_region: string | null;
	address_city: string | null;
	details: string | null;
	postal_code: string | null;
	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
	iban: string | null;
	bank_name: string | null;
};

export type BillingDetails = PartyDetails &
	(
		| {
				type: 'person';
				person_name: string;
				person_identification_number?: string | null;
		  }
		| {
				type: 'company';
				company_name: string;
				company_cui?: string | null;
				company_reg_com?: string | null;
		  }
	);

export type SellerDetails = PartyDetails & {
	company_name: string;
	company_cui?: string | null;
	company_reg_com?: string | null;
	/**
	 * The VAT registration code; `null` states the seller is not registered for VAT. Absent on a
	 * snapshot frozen before the API recorded it, which then states nothing either way.
	 */
	company_vat_number?: string | null;
};

export type InvoiceLineModel<D = Date | string> = {
	id: number;
	invoice_id: number;
	kind: InvoiceLineKind;

	// Where the line came from; all null on an adjustment
	order_line_id: number | null;
	shipping_id: number | null;
	/** On a reversal, the line of the original this one takes back. */
	parent_line_id: number | null;
	/**
	 * On a reversal, whether this line takes back value (a net price correction on goods the
	 * client keeps) rather than quantity.
	 */
	is_value_reversal: boolean;

	/*
	 * Only on an original read through `view`: how much of the line earlier reversals took back -
	 * quantity by quantity reversals, net by every reversal. What the reverse form caps at.
	 */
	reversed_quantity?: number;
	reversed_net?: number;
	/**
	 * Only on a draft read through `view`: how far a line raised from a source row may be
	 * restated - what that row has left to invoice, this line included, and its unit price.
	 * `null` on a line with no source to measure against.
	 */
	max_quantity?: number | null;
	max_unit_price?: number | null;
	product_id: number | null;
	variant_id: number | null;

	label: string;

	/*
	 * Real numbers on the wire, not the strings Postgres hands out for `numeric` - the API's
	 * decimal columns carry `numericTransformer`, which converts on read. Unlike `cash_flow`,
	 * nothing here is scaled by a factor: an invoice stores money at two decimals, as quoted.
	 */
	quantity: number;
	unit_price: number; // excluding VAT, in the invoice currency
	vat_rate: number;
	discount_reduction: number; // money off the whole line, excluding VAT

	// The line's own arithmetic, stored by the API rather than derived on read, so a printed
	// document keeps adding up whatever a pricing helper does later
	line_net: number;
	line_vat: number;
	line_total: number;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

/** How much of a cash movement settles this document - gross, in the invoice currency. */
export type InvoicePaymentModel<D = Date | string> = {
	id: number;
	invoice_id: number;
	cash_flow_id: number;
	amount: number;
	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export type InvoiceModel<D = Date | string> = {
	id: number;

	/** Who is billed - what the client ledger and payment allocation read by. */
	client_id: number;

	/*
	 * Null when there is no order behind the document: a revenue cash flow entry may be invoiced
	 * on its own, and such an invoice carries a single line worth what the movement was worth
	 * instead of the order's lines and its shipping.
	 */
	order_id: number | null;

	/*
	 * Null until the document is issued: a number is spent the moment it is handed out, so it is
	 * allocated on the transition to `issued` rather than when the row is created.
	 */
	ref_code: string | null;
	ref_number: number | null;

	/** The subscription a `subscription` document bills; null on every other type. */
	subscription_id: number | null;
	/** The movement a `shipping` document bills; a reversal carries its original's. */
	shipping_id: number | null;

	status: InvoiceStatus;
	payment_status: InvoicePaymentStatus;
	scope: InvoiceScope;

	/**
	 * A storno of `parent_invoice_id`. Its figures stay positive like any other document's - the
	 * flag carries the sign - and it is settled by money going back out.
	 */
	is_reversal: boolean;

	/** The document a reversal takes back; null on everything else. */
	parent_invoice_id: number | null;

	currency: Currency;
	exchange_rate: number;

	// Totals, summed by the API from the lines and stored - never recomputed here
	total_net: number;
	total_discount_reduction: number;
	total_vat: number;
	total_gross: number;

	issued_at: D | null;
	due_at: D | null;
	/**
	 * When the document first went past `due_at` unsettled. **Never cleared once stamped**, so it
	 * reads "was late at some point" - "late right now" is this plus a payment status that is not
	 * `paid`, which is what the overdue filter sends.
	 */
	overdue_at: D | null;
	paid_at: D | null;

	billing_details: BillingDetails | null;
	seller_details: SellerDetails | null;

	/**
	 * Only on a listing row: on an issued original, its net less what every non-canceled
	 * reversal already took back - 0 once nothing is left to reverse. `null` on drafts, canceled
	 * documents and reversals.
	 */
	reversible_net?: number | null;

	/**
	 * What an issued document still asks for: `total_gross` less its allocations and, on an
	 * original, less its issued reversals, floored at 0. A reversal counts only the refunds
	 * allocated to it. `null` on drafts and canceled documents. Computed by the API on the list
	 * and `view` reads - never stored.
	 */
	amount_outstanding?: number | null;

	/**
	 * Only on a draft read through `view`: the parties issuing would freeze if nothing were stated
	 * by hand - the buyer from the order's billing address (`null` while there is none), the
	 * seller from configuration. What the edit form starts from.
	 */
	resolved_billing_details?: BillingDetails | null;
	resolved_seller_details?: SellerDetails;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;

	/**
	 * The order this bills, joined by the listing so a row can show the reference a person reads
	 * rather than an id. Narrow on purpose - the API sends four columns of it.
	 */
	order?: Pick<OrderModel, 'id' | 'ref_code' | 'ref_number' | 'status'>;

	// Only on `read` - the list projection carries neither
	lines?: InvoiceLineModel<D>[];
	payments?: InvoicePaymentModel<D>[];
};

/**
 * A document as it prints - the API's `buildDocument`, answered by `GET /invoices/:id/document`
 * and by the buyer's `GET /public/orders/:order_id/invoices/:id` alike. Back-office notes are not
 * sent, nor where each line came from.
 */
export type InvoiceDocumentModel = {
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
	total_discount_reduction: number;
	total_vat: number;
	total_gross: number;
	issued_at: string | null;
	due_at: string | null;
	paid_at: string | null;
	billing_details: BillingDetails | null;
	seller_details: SellerDetails | null;
	/** The document a reversal takes back; null on an original. */
	parent_invoice: {
		id: number;
		ref_code: string | null;
		ref_number: number | null;
		issued_at: string | null;
	} | null;
	/** The order billed - a shipping document's is its movement's. Null on a custom document. */
	order: {
		id: number;
		ref_code: string;
		ref_number: number;
		created_at: string;
	} | null;
	/**
	 * On a shipping document, the movement billed, read live. An end is named by its snapshot once
	 * the movement shipped, before that by its warehouse or client address.
	 */
	shipping: {
		id: number;
		scope: ShippingScope;
		order_id: number | null;
		method: ShippingMethod;
		pickup_client_address_id: number | null;
		destination_client_address_id: number | null;
		pickup_client_address_label: string | null;
		destination_client_address_label: string | null;
		pickup_data: ShippingAddressSnapshot | null;
		destination_data: ShippingAddressSnapshot | null;
		pickup_warehouse: { id: number; name: string } | null;
		destination_warehouse: { id: number; name: string } | null;
		carrier: { id: number; name: string } | null;
		tracking_number: string | null;
		shipped_at: string | null;
		delivered_at: string | null;
		estimated_delivery_at: string | null;
	} | null;
	lines: {
		id: number;
		kind: InvoiceLineKind;
		is_value_reversal: boolean;
		label: string;
		quantity: number;
		unit_price: number; // excluding VAT
		vat_rate: number;
		discount_reduction: number; // money off the whole line, excluding VAT
		line_net: number;
		line_vat: number;
		line_total: number;
	}[];
};

/**
 * What a document is called in a window title. The printed reference where there is one, and the
 * id until then - a draft holds no number, so it has nothing else a person would recognize.
 */
export function displayInvoiceLabel(entry: InvoiceModel): string {
	if (entry.ref_code && entry.ref_number) {
		return `${entry.ref_code}-${entry.ref_number}`;
	}

	return `#${entry.id}`;
}

/**
 * A line's total as the API stores it - `InvoiceService.computeLine`, rounded per step the same
 * way, so the figure shown while typing is the one the save returns. `null` when the discount is
 * larger than the line value, which the API refuses, or a figure is not a number.
 */
export function computeInvoiceLineTotal(input: {
	quantity: number;
	unit_price: number;
	vat_rate: number;
	discount_reduction: number;
}): number | null {
	if (Object.values(input).some((value) => !Number.isFinite(value))) {
		return null;
	}

	const gross = roundMoney(input.unit_price * input.quantity);
	const discount = roundMoney(input.discount_reduction);

	if (discount > gross) {
		return null;
	}

	const net = roundMoney(gross - discount);

	return roundMoney(net + roundMoney((net * input.vat_rate) / 100));
}
