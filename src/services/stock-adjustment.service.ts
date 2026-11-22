import { ApiRequest } from '@/helpers/api.helper';
import type { StockAdjustmentModel } from '@/models/stock-adjustment.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Stock adjustments - `../nready-api/src/features/warehouse-movement`
 * (`stock-adjustment.routes.ts`). The list, the read and the create go through
 * `services.helper.ts`; what is here is the one action it cannot express.
 */

/** Undoes a posted adjustment; 409 once reversed, or when the stock it added was drawn since. */
export async function requestReverseStockAdjustment(
	id: number,
): Promise<ApiResponseFetch<StockAdjustmentModel>> {
	return await new ApiRequest().doFetch(`/stock-adjustments/${id}/reverse`, {
		method: 'PATCH',
	});
}
