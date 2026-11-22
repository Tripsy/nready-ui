import { ApiRequest } from '@/helpers/api.helper';
import type { VariantStockModel } from '@/models/warehouse-movement.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Stock reads beyond the ledger's own list and read - `../nready-api/src/features/warehouse-movement`.
 * The ledger itself and the low-stock report go through `services.helper.ts` as the
 * `warehouse-movement` and `low-stock` data sources.
 */

/**
 * A variant's stock: on hand per warehouse, reserved and available
 * (`GET /warehouse-movements/stock/:variant_id`). Never cached by the backend - every receipt,
 * order and cancel moves it.
 */
export async function requestVariantStock(
	variantId: number,
): Promise<ApiResponseFetch<VariantStockModel>> {
	return await new ApiRequest().doFetch(
		`/warehouse-movements/stock/${variantId}`,
		{ method: 'GET' },
	);
}
