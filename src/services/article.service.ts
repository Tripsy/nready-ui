import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { ArticleFeaturedStatus } from '@/models/article.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Reorders one featured group.
 *
 * `category_id` scopes the `category` group to a subtree and is meaningless for `section`; the
 * backend rejects the pair the other way round. `positions` must be the complete group in the
 * order it should read — the API compares the set against what it finds and refuses a subset.
 */
export async function orderUpdate(
	featured_status: ArticleFeaturedStatus,
	positions: number[],
	category_id?: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('article')}/featured/${featured_status}/order`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				positions,
				...(category_id ? { category_id } : {}),
			}),
		},
	);
}
