import type { StatusTransitions } from '@/types/common.type';

/** Mirrors `GrnStatusEnum` on `../nready-api/src/features/grn/grn.entity.ts`. */
export const GrnStatusEnum = {
	DRAFT: 'draft',
	CONFIRMED: 'confirmed',
	CANCELED: 'canceled',
} as const;

export type GrnStatus = (typeof GrnStatusEnum)[keyof typeof GrnStatusEnum];

/**
 * Mirrors `STATUS_TRANSITIONS` on the entity.
 *
 * Confirming is the one move that touches stock: the lots open, a receipt movement is posted per
 * line and each variant's `cost_price` is re-averaged. A confirmed receipt can still be canceled -
 * the backend posts the reversals, and refuses once any lot has been drawn from - but it never
 * returns to draft.
 */
export const GRN_STATUS_TRANSITIONS: StatusTransitions<GrnStatus> = {
	[GrnStatusEnum.DRAFT]: [GrnStatusEnum.CONFIRMED, GrnStatusEnum.CANCELED],
	[GrnStatusEnum.CONFIRMED]: [GrnStatusEnum.CANCELED],
	[GrnStatusEnum.CANCELED]: [],
};

/** Mirrors the backend validator's ceilings (`grn.validator.ts`). */
export const GRN_ITEMS_MAX = 500;
export const GRN_SUPPLIER_DOCUMENT_MAX = 100;
export const GRN_LOT_CODE_MAX = 100;

/**
 * One received line - and, once confirmed, the FIFO lot it opened.
 *
 * `qty_remaining` is what is still in the lot: 0 on a draft, `qty` right after confirmation, drawn
 * down as stock leaves. `unit_cost_base` is the cost frozen in the base currency at the receipt's
 * rate. `sku` and `label` come only with the read, resolved from the variant and its product.
 */
export type GrnItemModel<D = Date | string> = {
	id: number;
	grn_id: number;
	variant_id: number;

	qty: number;
	qty_remaining: number;
	unit_cost: number;
	unit_cost_base: number;
	vat_rate: number;
	lot_code: string | null;
	expires_at: string | null;
	notes: string | null;

	sku?: string | null;
	label?: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

/**
 * A goods received note. The list and the read carry the same header columns plus the warehouse
 * and vendor names; only the read carries `items`.
 */
export type GrnModel<D = Date | string> = {
	id: number;

	ref_code: string;
	ref_number: number;
	supplier_document_number: string | null;
	status: GrnStatus;
	received_at: D;
	confirmed_at: D | null;
	currency: string;
	exchange_rate: number;
	notes: string | null;

	warehouse_id: number;
	vendor_id: number;
	warehouse?: { id: number; code: string; name: string } | null;
	vendor?: { id: number; name: string } | null;

	items?: GrnItemModel<D>[];

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

/** The reference printed on the document, `NIR-42`. */
/**
 * A price row whose floor no longer covers what the variant costs (`GET /grns/cost-over-floor`),
 * tightest first. The floor is `min_price`, or `sale_price` where none is set; both exclude VAT
 * and are in the row's `currency`. `cost_price` is the weighted average set by confirmed receipts
 * and `floor_base` the floor converted to it, both in the base currency (`Configuration.currency()`).
 *
 * `id` is the row's position in the report, set by the definition's `find`: the backend row has
 * none, and one variant appears once per currency, so `variant_id` cannot stand in.
 */
export type CostOverFloorModel = {
	id: number;
	variant_id: number;
	sku: string;
	cost_price: number;
	currency: string;
	sale_price: number;
	min_price: number | null;
	floor_base: number;
};

export const displayGrnReference = (
	entry: Pick<GrnModel, 'ref_code' | 'ref_number'>,
): string => `${entry.ref_code}-${entry.ref_number}`;

export const displayGrnLabel = (entry: GrnModel): string =>
	displayGrnReference(entry);
