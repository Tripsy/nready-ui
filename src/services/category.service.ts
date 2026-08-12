import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { CategoryType } from '@/models/category.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Reorders one sibling group. The backend reads the group as "same type, same parent" and
 * treats an absent `parent_id` as the roots of that type — so the key is omitted rather than
 * sent as null, which `JSON.stringify` does for an `undefined` value.
 */
export async function orderUpdate(
	type: CategoryType,
	parent_id: number | null,
	positions: number[],
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('category')}/${type}/order`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				parent_id: parent_id ?? undefined,
				positions,
			}),
		},
	);
}
