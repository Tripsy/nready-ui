import type {
	ProductComposition,
	ProductPriceType,
	ProductSaleStatus,
	ProductType,
	ProductUnit,
	ProductVatCategory,
	ProductWorkflow,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

/**
 * One row of the catalog listed by the thing that is actually sold.
 *
 * Not `ProductVariantType` (`product.model.ts`), which is the *form's* shape — that one carries
 * no id, no `product_id` and no product at all, because it only ever exists inside the payload
 * that syncs a product's whole variant set. This is what `GET /product-variants` returns: the
 * variant's own columns, the slice of its product the listing shows, and its prices.
 */
export type ProductVariantModel<D = Date | string> = {
	id: number;
	product_id: number;

	sku: string;
	barcode: string | null;
	position: number;
	is_default: boolean;
	track_stock: boolean;
	low_stock_threshold: number | null;
	allow_backorder: boolean;
	cost_price: number | null;

	// Timestamps
	created_at: D;
	updated_at: D;
	/**
	 * The variant's own withdrawal. A variant whose *product* was deleted carries `null` here
	 * and a timestamp on `product.deleted_at` — soft-deleting a product does not cascade to its
	 * variants. `resolveDeletedAt` reads the two as one, which is what every row-level "is this
	 * deleted" question actually means.
	 */
	deleted_at: D | null;

	/*
	 * Relations the listing joins. `product` is an INNER join so it is always present, but it
	 * stays optional here: the same type names a row before it has been through the listing's
	 * normalization, and a narrower projection would otherwise be a lie.
	 */
	product?: {
		id: number;
		workflow: ProductWorkflow;
		sale_status: ProductSaleStatus;
		type: ProductType;
		composition: ProductComposition;
		unit: ProductUnit;
		vat_category: ProductVatCategory;
		brand_id: number | null;
		deleted_at: D | null;
		brand?: { id: number; name: string } | null;
		contents?: { language: Language; slug: string; label: string }[];
	} | null;
	prices?: ProductPriceType[];
};

/**
 * When the row stopped being sellable, from either cause: the variant was withdrawn, or its
 * product was deleted and took the whole set out of the catalog with it.
 */
export function resolveDeletedAt<D>(
	entry: ProductVariantModel<D>,
): D | null | undefined {
	return entry.deleted_at ?? entry.product?.deleted_at;
}

/** The product's wording in the served language — the row's human name. */
export function getProductVariantLabel(
	entry: ProductVariantModel,
): string | null {
	return entry.product?.contents?.[0]?.label ?? null;
}

/**
 * How a variant names itself in a picker. The SKU is the part that is always there — `label`
 * comes from the product's content row for the active language and is absent for a product with
 * no translation in it — so it leads, and the name only qualifies it.
 */
export function displayProductVariantLabel(entry: ProductVariantModel): string {
	const label = getProductVariantLabel(entry);

	return label ? `${entry.sku} — ${label}` : entry.sku;
}
