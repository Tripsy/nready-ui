import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import type { DiscountTargetMap } from '@/models/discount.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The entities a discount is linked to, grouped by scope. Scopes with no links are omitted by
 * the backend, so an absent key and an empty array mean the same thing on read.
 */
export async function requestDiscountTargets(
	discountId: number,
): Promise<DiscountTargetMap> {
	const response: ApiResponseFetch<DiscountTargetMap> =
		await new ApiRequest().doFetch(`/discounts/${discountId}/targets`);

	return getResponseData(response) ?? {};
}

/**
 * Replaces the links for the scopes present in `targets`.
 *
 * Absent scopes are left untouched by the backend, so the caller must send an explicit empty
 * array to clear one - which is what the form does for the scope it is editing.
 */
export async function requestUpdateDiscountTargets(
	discountId: number,
	targets: DiscountTargetMap,
): Promise<ApiResponseFetch<DiscountTargetMap>> {
	return new ApiRequest().doFetch(`/discounts/${discountId}/targets`, {
		method: 'PUT',
		body: JSON.stringify(targets),
	});
}
