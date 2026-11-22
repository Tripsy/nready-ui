import type { ShippingStatus } from '@/models/shipping.model';
import type { StatusTransitions } from '@/types/common.type';
import type { EntityId } from '@/types/entity-id.type';

/** Mirrors `OrderReturnStatusEnum` on `../nready-api/src/features/order-return/order-return.entity.ts`. */
export const OrderReturnStatusEnum = {
	REQUESTED: 'requested',
	APPROVED: 'approved',
	REJECTED: 'rejected',
	RECEIVED: 'received',
	CLOSED: 'closed',
	CANCELED: 'canceled',
} as const;

export type OrderReturnStatus =
	(typeof OrderReturnStatusEnum)[keyof typeof OrderReturnStatusEnum];

/**
 * Mirrors `STATUS_TRANSITIONS` on the entity.
 *
 * Two of the moves are not made through the status route: `approved` writes the return shipment,
 * so it has a form of its own, and `received` is set by the backend when that shipment arrives.
 */
export const ORDER_RETURN_STATUS_TRANSITIONS: StatusTransitions<OrderReturnStatus> =
	{
		[OrderReturnStatusEnum.REQUESTED]: [
			OrderReturnStatusEnum.APPROVED,
			OrderReturnStatusEnum.REJECTED,
			OrderReturnStatusEnum.CANCELED,
		],
		[OrderReturnStatusEnum.APPROVED]: [
			OrderReturnStatusEnum.RECEIVED,
			OrderReturnStatusEnum.CANCELED,
		],
		[OrderReturnStatusEnum.RECEIVED]: [OrderReturnStatusEnum.CLOSED],
		[OrderReturnStatusEnum.REJECTED]: [],
		[OrderReturnStatusEnum.CLOSED]: [],
		[OrderReturnStatusEnum.CANCELED]: [],
	};

/** The moves `PATCH /order-returns/:id/status/:status` takes - `MANUAL_STATUSES` on the entity. */
export const ORDER_RETURN_MANUAL_STATUSES: readonly OrderReturnStatus[] = [
	OrderReturnStatusEnum.REJECTED,
	OrderReturnStatusEnum.CANCELED,
	OrderReturnStatusEnum.CLOSED,
];

/** Mirrors `OrderReturnReasonEnum` on the entity. */
export const OrderReturnReasonEnum = {
	DAMAGED: 'damaged',
	DEFECTIVE: 'defective',
	WRONG_ITEM: 'wrong_item',
	NOT_AS_DESCRIBED: 'not_as_described',
	NO_LONGER_NEEDED: 'no_longer_needed',
	OTHER: 'other',
} as const;

export type OrderReturnReason =
	(typeof OrderReturnReasonEnum)[keyof typeof OrderReturnReasonEnum];

/** Mirrors the backend validator's ceilings (`order-return.validator.ts`). */
export const ORDER_RETURN_LINES_MAX = 200;
export const ORDER_RETURN_NOTES_MAX = 2000;

/**
 * What the request asks to send back, by variant. The goods that actually travel - and the
 * condition they arrived in - are the lines of the return shipment, which the warehouse may
 * correct on arrival.
 */
export type OrderReturnLineModel<D = Date | string> = {
	id: EntityId;
	order_return_id: EntityId;
	variant_id: EntityId;
	product_id: EntityId;
	quantity: number;

	/** Attached by the read: the variant's SKU and the product's name, null when unresolved. */
	sku?: string | null;
	label?: string | null;

	created_at: D;
	updated_at: D;
	deleted_at?: D | null;
};

/**
 * A return authorization. The dashboard list and read carry the order reference and the return
 * shipment's progress; the storefront read omits `notes`, `user_id` and `reversal_invoice_ids`.
 */
export type OrderReturnModel<D = Date | string> = {
	id: EntityId;

	ref_code: string;
	ref_number: number;
	status: OrderReturnStatus;
	reason: OrderReturnReason;
	customer_notes: string | null;
	response: string | null;
	notes?: string | null;
	decided_at: D | null;
	received_at: D | null;
	closed_at: D | null;
	/** The draft reversals raised for the returned goods - issuing one is what refunds. */
	reversal_invoice_ids?: EntityId[];
	/** Whether the refund also pays back the outbound delivery fee - read when it is drafted. */
	refund_shipping?: boolean;

	order_id: EntityId;
	shipping_id?: EntityId | null;
	user_id?: EntityId | null;

	order?: {
		id: EntityId;
		ref_code: string;
		ref_number: number;
		client_id: EntityId;
	} | null;
	shipping?: {
		id: EntityId;
		status: ShippingStatus;
		destination_warehouse_id?: EntityId | null;
		tracking_number: string | null;
		tracking_url: string | null;
		shipped_at?: D | null;
		delivered_at?: D | null;
	} | null;

	lines?: OrderReturnLineModel<D>[];

	created_at: D;
	updated_at: D;
	deleted_at?: D | null;
};

/** One variant of an order the return form can offer, with what is still left to send back. */
export type OrderReturnableLineModel = {
	variant_id: EntityId;
	product_id: EntityId;
	sku: string | null;
	label: string | null;
	returnable: number;
};

/** `GET .../returnable` - the last day to ask (null while nothing arrived) and the lines. */
export type OrderReturnableModel<D = Date | string> = {
	deadline: D | null;
	lines: OrderReturnableLineModel[];
};

/** The reference printed on the document, `RMA-7`. */
export const displayOrderReturnReference = (
	entry: Pick<OrderReturnModel, 'ref_code' | 'ref_number'>,
): string => `${entry.ref_code}-${entry.ref_number}`;

export const displayOrderReturnLabel = (entry: OrderReturnModel): string =>
	displayOrderReturnReference(entry);

/** What a line is called on screen: the product name, else the SKU, else the variant id. */
export const displayOrderReturnLineLabel = (
	line: Pick<OrderReturnLineModel, 'label' | 'sku' | 'variant_id'>,
): string => line.label ?? line.sku ?? `#${line.variant_id}`;
