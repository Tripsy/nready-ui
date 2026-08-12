import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { BrandType } from '@/models/brand.model';
import type { ApiResponseFetch } from '@/types/api.type';

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
