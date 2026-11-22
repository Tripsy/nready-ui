import type { WarehouseMovementModel } from '@/models/warehouse-movement.model';
import type { EntityId } from '@/types/entity-id.type';

/**
 * Stock changed by hand - `../nready-api/src/features/warehouse-movement` (`/stock-adjustments`).
 * Units added or removed at one warehouse for a stated reason; each moves the warehouse's lots and
 * posts the ledger rows saying so, and is undone as a whole by `reverse`, never edited.
 */

/** Mirrors `StockAdjustmentDirectionEnum` - which way the units go. */
export const StockAdjustmentDirectionEnum = {
	ADD: 'add',
	REMOVE: 'remove',
} as const;

export type StockAdjustmentDirection =
	(typeof StockAdjustmentDirectionEnum)[keyof typeof StockAdjustmentDirectionEnum];

/** Mirrors `StockAdjustmentReasonEnum`. `audit` - a shelf count - goes either way. */
export const StockAdjustmentReasonEnum = {
	AUDIT: 'audit',
	DAMAGED: 'damaged',
	EXPIRED: 'expired',
	LOST: 'lost',
	THEFT: 'theft',
	SAMPLE: 'sample',
	FOUND: 'found',
	SAMPLE_RETURNED: 'sample_returned',
	RETURN: 'return',
} as const;

export type StockAdjustmentReason =
	(typeof StockAdjustmentReasonEnum)[keyof typeof StockAdjustmentReasonEnum];

/**
 * The reasons each direction admits - mirrors `STOCK_ADJUSTMENT_REASONS` on the entity, where a
 * database check holds the same lists. Nothing comes back into stock as "damaged".
 */
export const STOCK_ADJUSTMENT_REASONS: Record<
	StockAdjustmentDirection,
	readonly StockAdjustmentReason[]
> = {
	[StockAdjustmentDirectionEnum.REMOVE]: [
		StockAdjustmentReasonEnum.AUDIT,
		StockAdjustmentReasonEnum.DAMAGED,
		StockAdjustmentReasonEnum.EXPIRED,
		StockAdjustmentReasonEnum.LOST,
		StockAdjustmentReasonEnum.THEFT,
		StockAdjustmentReasonEnum.SAMPLE,
	],
	[StockAdjustmentDirectionEnum.ADD]: [
		StockAdjustmentReasonEnum.AUDIT,
		StockAdjustmentReasonEnum.FOUND,
		StockAdjustmentReasonEnum.SAMPLE_RETURNED,
		StockAdjustmentReasonEnum.RETURN,
	],
};

/** Mirrors `StockAdjustmentStatusEnum`. */
export const StockAdjustmentStatusEnum = {
	CREATED: 'created',
	REVERSED: 'reversed',
} as const;

export type StockAdjustmentStatus =
	(typeof StockAdjustmentStatusEnum)[keyof typeof StockAdjustmentStatusEnum];

/** `numeric(12,2)` on the backend - the most a quantity field may state. */
export const STOCK_ADJUSTMENT_QUANTITY_MAX = 9_999_999_999.99;

export const STOCK_ADJUSTMENT_NOTES_MAX = 2000;

/**
 * One adjustment. `qty` is the signed change actually posted - positive added, negative removed;
 * the direction is its sign. `movements` - the ledger rows it posted, then the ones that undid it -
 * come on the single read only.
 */
export type StockAdjustmentModel<D = Date | string> = {
	id: EntityId;
	reason: StockAdjustmentReason;
	qty: number;
	status: StockAdjustmentStatus;
	reversed_at: D | null;
	notes: string | null;
	warehouse_id: EntityId;
	variant_id: EntityId;

	warehouse?: { id: EntityId; code: string; name: string } | null;
	variant?: { id: EntityId; sku: string; product_id: EntityId } | null;
	movements?: WarehouseMovementModel<D>[];

	created_at: D;
	updated_at: D | null;
};

/** Which way an adjustment went, read off its sign. */
export function adjustmentDirection(
	entry: Pick<StockAdjustmentModel, 'qty'>,
): StockAdjustmentDirection {
	return Number(entry.qty) > 0
		? StockAdjustmentDirectionEnum.ADD
		: StockAdjustmentDirectionEnum.REMOVE;
}
