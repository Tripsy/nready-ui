import { type OrderModel, OrderStatusEnum } from '@/models/order.model';
import type { Currency, StatusTransitions } from '@/types/common.type';

export const InvoiceStatusEnum = {
	DRAFT: 'draft', // Being assembled, holds no number yet, still editable
	ISSUED: 'issued', // Number allocated, document frozen
	CANCELLED: 'canceled', // Invalidated before it was ever settled
} as const;

export type InvoiceStatus =
	(typeof InvoiceStatusEnum)[keyof typeof InvoiceStatusEnum];

/**
 * A document moves one way only, and `canceled` is terminal: a cancellation that has to undo
 * money already taken is a credit note, not a way back up this list. Mirrors
 * `STATUS_TRANSITIONS` in the API's `invoice.entity.ts` - the backend refuses anything else.
 */
export const STATUS_TRANSITIONS: StatusTransitions<InvoiceStatus> = {
	[InvoiceStatusEnum.DRAFT]: [
		InvoiceStatusEnum.ISSUED,
		InvoiceStatusEnum.CANCELLED,
	],

	[InvoiceStatusEnum.ISSUED]: [InvoiceStatusEnum.CANCELLED],

	[InvoiceStatusEnum.CANCELLED]: [],
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
 * Each type draws its number from its own series, so a credit note never spends a number out of
 * the invoice series.
 *
 * `credit_note` is absent from the create form on purpose: it is raised against the charge it
 * reverses, through the credit note action, and the API refuses it on the plain create route -
 * which leaves `charge` as the only type a document can be raised as, so the form does not ask.
 */
export const InvoiceTypeEnum = {
	CHARGE: 'charge',
	CREDIT_NOTE: 'credit_note',
} as const;

export type InvoiceType =
	(typeof InvoiceTypeEnum)[keyof typeof InvoiceTypeEnum];

/**
 * The order states a document may be raised from, mirroring `INVOICEABLE_ORDER_STATUSES` on the
 * API: one the business has agreed to, and one it has fulfilled. The API refuses the rest, so the
 * order picker offers only these.
 */
export const INVOICEABLE_ORDER_STATUSES = [
	OrderStatusEnum.CONFIRMED,
	OrderStatusEnum.COMPLETED,
];

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
type PartyDetails = {
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
};

export type InvoiceLineModel<D = Date | string> = {
	id: number;
	invoice_id: number;
	kind: InvoiceLineKind;

	// Where the line came from; all null on an adjustment
	order_line_id: number | null;
	shipping_id: number | null;
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

	status: InvoiceStatus;
	payment_status: InvoicePaymentStatus;
	type: InvoiceType;

	/** The charge a credit note reverses; null on everything else. */
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
 * What a document is called in a window title. The printed reference where there is one, and the
 * id until then - a draft holds no number, so it has nothing else a person would recognize.
 */
export function displayInvoiceLabel(entry: InvoiceModel): string {
	if (entry.ref_code && entry.ref_number) {
		return `${entry.ref_code}-${entry.ref_number}`;
	}

	return `#${entry.id}`;
}
