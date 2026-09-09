import {
	ApiRequest,
	buildQueryString,
	resolveRequestPath,
} from '@/helpers/api.helper';
import type { BrandModel, BrandType } from '@/models/brand.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import type { Language } from '@/types/common.type';

/**
 * The anonymous listing (`GET /public/brands`), which returns only active brands and accepts no
 * status filter at all.
 *
 * Server-side only, via `remote-api`: the `/api/proxy` route the dashboard uses attaches the
 * session cookie, and this page has no visitor to attach. Going straight to the backend also
 * lets the response participate in Next's data cache - `revalidate` is the caller's to set,
 * since only it knows how fresh the page has to be.
 */
export async function requestPublicBrands(params: {
	brand_type?: BrandType;
	language?: Language;
	limit?: number;
	revalidate?: number;
}): Promise<ApiResponseFetch<FindFunctionResponseType<BrandModel>>> {
	const { revalidate, limit, brand_type, language } = params;

	const query = buildQueryString({
		order_by: 'sort_order',
		direction: 'ASC',
		limit,
		filter: { brand_type, language },
	});

	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/brands${query ? `?${query}` : ''}`, {
			method: 'GET',
			next: { revalidate },
		});
}

export async function orderUpdate(
	brand_type: BrandType,
	positions: number[],
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('brand')}/${brand_type}/order`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				positions,
			}),
		},
	);
}
