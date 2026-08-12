import {
	ApiRequest,
	buildQueryString,
	resolveRequestPath,
} from '@/helpers/api.helper';
import type { CategoryModel, CategoryType } from '@/models/category.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import type { Language } from '@/types/common.type';

/**
 * The anonymous listing (`GET /public/categories`), which returns only active categories and
 * accepts no status filter at all.
 *
 * Server-side only, via `remote-api`: the `/api/proxy` route the dashboard uses attaches the
 * session cookie, and this page has no visitor to attach. Going straight to the backend also
 * lets the response participate in Next's data cache — `revalidate` is the caller's to set,
 * since only it knows how fresh the page has to be.
 */
export async function requestPublicCategories(params: {
	type: CategoryType;
	language?: Language;
	is_root?: boolean;
	parent_id?: number;
	limit?: number;
	revalidate?: number;
}): Promise<ApiResponseFetch<FindFunctionResponseType<CategoryModel>>> {
	const { revalidate, limit, type, language, is_root, parent_id } = params;

	const query = buildQueryString({
		order_by: 'sort_order',
		direction: 'DESC',
		limit,
		filter: { type, language, is_root, parent_id },
	});

	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/categories${query ? `?${query}` : ''}`, {
			method: 'GET',
			next: { revalidate },
		});
}

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
