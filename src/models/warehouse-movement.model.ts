/**
 * The stock ledger and the stock figures read from it - `../nready-api/src/features/warehouse-movement`.
 * Read-only: every row is posted by the document that moved the goods (a goods receipt, a delivery
 * shipping or coming back, a client return arriving), never by a person.
 */

/** Mirrors `WarehouseMovementTypeEnum` on `warehouse-movement.entity.ts`. */
export const WarehouseMovementTypeEnum = {
	RECEIPT: 'receipt',
	SALE: 'sale',
	SALE_RETURN: 'sale_return',
	SUPPLIER_RETURN: 'supplier_return',
	ADJUSTMENT: 'adjustment',
	WRITE_OFF: 'write_off',
	TRANSFER_IN: 'transfer_in',
	TRANSFER_OUT: 'transfer_out',
} as const;

export type WarehouseMovementType =
	(typeof WarehouseMovementTypeEnum)[keyof typeof WarehouseMovementTypeEnum];

/** Mirrors `WarehouseMovementSourceEnum` - what document a row answers to. */
export const WarehouseMovementSourceEnum = {
	GRN_ITEM: 'grn_item',
	SHIPPING_LINE: 'shipping_line',
	ADJUSTMENT: 'adjustment',
} as const;

export type WarehouseMovementSource =
	(typeof WarehouseMovementSourceEnum)[keyof typeof WarehouseMovementSourceEnum];

/**
 * One ledger row. `qty` is signed - positive brings stock in, negative takes it out - and
 * `unit_cost_base` is the lot's cost in the base currency. `warehouse` and `variant` are the names
 * the read joins; either is null when the row it points at has gone since.
 */
export type WarehouseMovementModel<D = Date | string> = {
	id: number;
	movement_type: WarehouseMovementType;
	qty: number;
	unit_cost_base: number;
	source_type: WarehouseMovementSource;
	source_id: number | null;
	occurred_at: D;
	notes: string | null;
	warehouse_id: number;
	variant_id: number;
	/** The lot (`grn_item`) the units came from or went back into. */
	grn_item_id: number | null;
	/** The row this one answers - a canceled receipt, a parcel back undelivered. */
	reversal_of_id: number | null;

	warehouse?: { id: number; code: string; name: string } | null;
	variant?: { id: number; sku: string; product_id: number } | null;

	created_at: D;
};

/** One warehouse's share of a variant's stock (`GET /warehouse-movements/stock/:variant_id`). */
export type WarehouseStockModel = {
	warehouse_id: number;
	code: string;
	name: string;
	/** An inactive site's lots are listed but not counted as on hand - it ships nothing. */
	status: string;
	on_hand: number;
};

/**
 * A variant's stock: on hand in active warehouses, promised to live orders, and what is left to
 * sell. `available` goes negative when the variant is over-committed.
 */
export type VariantStockModel = {
	variant_id: number;
	on_hand: number;
	reserved: number;
	available: number;
	warehouses: WarehouseStockModel[];
};

/**
 * A tracked variant at or under its low-stock threshold, measured on available rather than on
 * hand (`GET /warehouse-movements/low-stock`), lowest first.
 *
 * `id` is the variant's id, set by the low-stock definition's `find`: the backend row has no id
 * of its own, and the data table and the window stack identify an entry by `id`.
 */
export type LowStockModel = {
	id: number;
	variant_id: number;
	product_id: number;
	sku: string;
	on_hand: number;
	reserved: number;
	available: number;
	low_stock_threshold: number | null;
};

/** `+12` / `-3` - a ledger quantity reads with its direction. */
export function displaySignedQuantity(qty: number): string {
	const value = Number(qty);

	return value > 0 ? `+${value}` : String(value);
}

/**
 * The row's warehouse as `CODE - Name`, or its id when the join came back empty. Takes any row
 * carrying the joined warehouse - a ledger movement or a stock adjustment.
 */
export function displayMovementWarehouse(
	entry: Pick<WarehouseMovementModel, 'warehouse' | 'warehouse_id'>,
): string {
	return entry.warehouse
		? `${entry.warehouse.code} - ${entry.warehouse.name}`
		: `#${entry.warehouse_id}`;
}

/** The row's variant by SKU, or its id when the join came back empty. */
export function displayMovementVariant(
	entry: Pick<WarehouseMovementModel, 'variant' | 'variant_id'>,
): string {
	return entry.variant?.sku ?? `#${entry.variant_id}`;
}
