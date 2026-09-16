import type { ClientType } from '@/models/client.model';
import type { StatusTransitions } from '@/types/common.type';

/**
 * The document's lifecycle, mirroring `order.entity.ts`.
 *
 * The line runs one way: placed, accepted, fulfilled. Every order enters at `pending` - from a
 * checkout or the back office - and that is the one state whose lines may still be adjusted.
 * Nothing returns to it once confirmed.
 */
export const OrderStatusEnum = {
	PENDING: 'pending',
	CONFIRMED: 'confirmed',
	COMPLETED: 'completed',
	CANCELLED: 'canceled',
} as const;

export type OrderStatus =
	(typeof OrderStatusEnum)[keyof typeof OrderStatusEnum];

/**
 * Mirrors `STATUS_TRANSITIONS` on the entity. `completed` and `canceled` are both terminal - a
 * fulfilled order that goes wrong is corrected on the money, not on the document.
 */
export const ORDER_STATUS_TRANSITIONS: StatusTransitions<OrderStatus> = {
	[OrderStatusEnum.PENDING]: [
		OrderStatusEnum.CONFIRMED,
		OrderStatusEnum.CANCELLED,
	],
	[OrderStatusEnum.CONFIRMED]: [
		OrderStatusEnum.COMPLETED,
		OrderStatusEnum.CANCELLED,
	],
	[OrderStatusEnum.COMPLETED]: [],
	[OrderStatusEnum.CANCELLED]: [],
};

export const OrderTypeEnum = {
	STANDARD: 'standard',
	SUBSCRIPTION: 'subscription',
} as const;

export type OrderType = (typeof OrderTypeEnum)[keyof typeof OrderTypeEnum];

/**
 * How the client said they will pay, mirroring `OrderPaymentMethodEnum` on the entity. A recorded
 * choice only - nothing charges or captures a payment yet. Null on a back-office document.
 */
export const OrderPaymentMethodEnum = {
	CASH_ON_DELIVERY: 'cash_on_delivery',
	CARD: 'card',
	BANK_TRANSFER: 'bank_transfer',
} as const;

export type OrderPaymentMethod =
	(typeof OrderPaymentMethodEnum)[keyof typeof OrderPaymentMethodEnum];

/** Mirrors `varchar(10)` on the backend `order.ref_code` column. */
export const ORDER_REF_CODE_MAX_LENGTH = 10;

/** What one request may compose, mirroring `ORDER_LINES_MAX` in the backend validator. */
export const ORDER_LINES_MAX = 200;

/** One rule that reduced a line, as the backend snapshotted it when the order was raised. */
export type OrderDiscountSnapshot = {
	label: string;
	scope: string;
	reason: string | null;
	reference?: string | null;
	type: string;
	value: number;
	/** The rule it came from; absent on snapshots written before it was recorded. */
	discount_id?: number;
	/**
	 * What this rule alone took off the line. A line may carry its own discount and, stacked on
	 * top, its share of an order-wide campaign - `discount_reduction` is their sum.
	 */
	reduction?: number;
};

/** What a chosen option did to the line's unit price, in the order's currency. */
export type OrderOptionSnapshot = {
	/** The option it was taken from - absent on snapshots written before it was recorded. */
	option_id?: number;
	label: string;
	price_delta: number;
	currency: string;
};

/**
 * One line of the document, frozen at the moment the order was raised.
 *
 * `price` is the unit price excluding VAT, with any option deltas already folded in - the
 * `options` list is the record of what moved it, not an amount still to be added. A bundle header
 * line carries `price = 0` and the component lines beneath it (`parent_id`) carry the money, each
 * at its own VAT rate.
 */
export type OrderLineModel<D = Date | string> = {
	id: number;
	order_id: number;
	parent_id: number | null;

	variant_id: number;
	product_id: number;

	quantity: number;
	price: number;
	vat_rate: number;
	currency: string;
	exchange_rate: number;

	discount: OrderDiscountSnapshot[] | null;
	/** Money off the whole line, in the line's currency - what the snapshot above was worth. */
	discount_reduction: number;
	options: OrderOptionSnapshot[] | null;
	notes: string | null;

	variant?: { id: number; sku: string } | null;
	/** The product's name in the default content language, attached by the read; null when it has none. */
	label?: string | null;

	created_at?: D;
	updated_at?: D;
	deleted_at?: D | null;
};

/**
 * What the document adds up to, as the backend computes it.
 *
 * `subtotal` is the lines at their quoted prices, `discount_reduction` what the catalog's rules
 * took off them, and VAT is charged per line on the difference - so `total` is
 * `subtotal - discount_reduction + vat_amount`. Show the figures as they arrive: the reduction was
 * resolved and clamped when the order was raised, and nothing on this side can recompute it from
 * the snapshots.
 */
export type OrderTotalsModel = {
	currency: string;
	exchange_rate: number;
	subtotal: number;
	/** Everything the catalog's rules took off, the order-wide campaign included. */
	discount_reduction: number;
	/**
	 * How much of `discount_reduction` came from an order-wide campaign rather than the lines'
	 * own rules. **Already inside** that figure - show it as a breakdown, never subtract it again.
	 */
	order_discount_reduction: number;
	vat_amount: number;
	total: number;
	has_discount: boolean;
};

/**
 * An order is the document the business raises against a client - what was agreed, at what price.
 *
 * `lines` and `totals` come from the read endpoint only: the listing joins the client and stops
 * there, because loading every line of every row is the query's whole cost. A detail window
 * re-reads the row to get them.
 */
export type OrderModel<D = Date | string> = {
	id: number;

	client_id: number;
	/**
	 * The client address the order is billed to, referenced rather than copied.
	 *
	 * Null on a back-office document raised before one is agreed, and null again once that address
	 * is deleted - the backend key is `SET NULL`. An invoice raised from the order is where the
	 * billing details get frozen.
	 */
	billing_address_id: number | null;
	ref_code: string;
	ref_number: number;
	status: OrderStatus;
	type: OrderType;
	payment_method: OrderPaymentMethod | null;
	issued_at: D;
	notes: string | null;

	/*
	 * The narrow select the backend joins onto a listing row, declared inline rather than picked
	 * off `ClientModel`: that type is a discriminated union where the branch not taken types its
	 * counterpart's name column as `never`, and this projection carries both columns with one of
	 * them null. `person_identification_number` is not among them by design.
	 */
	client?: {
		id: number;
		client_type: ClientType;
		status: string;
		company_name: string | null;
		person_name: string | null;
		contact_email: string | null;
	} | null;

	lines?: OrderLineModel<D>[];
	totals?: OrderTotalsModel;

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

/**
 * The reference as a person cites it - "ORD-1183".
 *
 * Takes the two columns it reads rather than a whole order, so the narrow projections other
 * entities join an order as - a shipment's `order`, say - can be labelled with it too.
 */
export const displayOrderReference = (
	entry: Pick<OrderModel, 'ref_code' | 'ref_number'>,
): string => `${entry.ref_code}-${entry.ref_number}`;

export const displayOrderLabel = (entry: OrderModel): string =>
	displayOrderReference(entry);

/** How the counterparty names itself: a company by its name, a person by theirs. */
export const displayOrderClient = (entry: OrderModel): string => {
	const client = entry.client;

	if (!client) {
		return `#${entry.client_id}`;
	}

	return client.company_name ?? client.person_name ?? `#${client.id}`;
};

/** A money figure as the dashboard shows it: two decimals, then the code. */
export const displayOrderMoney = (value: number, currency: string): string =>
	`${value.toFixed(2)} ${currency}`;
