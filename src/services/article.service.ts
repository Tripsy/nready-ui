import {
	ApiRequest,
	buildQueryString,
	resolveRequestPath,
} from '@/helpers/api.helper';
import type {
	ArticleFeaturedStatus,
	ArticleModel,
} from '@/models/article.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import type { Language } from '@/types/common.type';

export type PublicArticlesParams = {
	language?: Language;
	term?: string;
	featured_status?: ArticleFeaturedStatus;
	category_id?: number;
	/** Any of these tags - the article page's "similar" box passes the whole set. */
	tag_id?: number[];
	/** Article to leave out, so a sidebar never recommends the page it sits on. */
	exclude_id?: number;
	/** One article by id - how a permalink resolves a target it only knows the id of. */
	id?: number;
	page?: number;
	limit?: number;
};

function buildPublicArticlesQuery(params: PublicArticlesParams): string {
	const {
		page,
		limit,
		language,
		term,
		featured_status,
		category_id,
		tag_id,
		exclude_id,
		id,
	} = params;

	return buildQueryString({
		order_by: 'publish_at',
		direction: 'DESC',
		page,
		limit,
		filter: {
			language,
			term,
			featured_status,
			category_id,
			tag_id,
			exclude_id,
			id,
		},
	});
}

/**
 * The anonymous listing (`GET /public/articles`), which returns only published, listed
 * articles and accepts none of the dashboard filters that could widen that window.
 *
 * Server-side only, via `remote-api`: the `/api/proxy` route the dashboard uses attaches the
 * session cookie, and this page has no visitor to attach. Going straight to the backend also
 * lets the response participate in Next's data cache - `revalidate` is the caller's to set,
 * since only it knows how fresh the listing has to be.
 *
 * Rows carry no body (`content`); each carries its categories and its cover image.
 */
export async function requestPublicArticles(
	params: PublicArticlesParams & { revalidate?: number },
): Promise<ApiResponseFetch<FindFunctionResponseType<ArticleModel>>> {
	const { revalidate, ...filters } = params;

	const query = buildPublicArticlesQuery(filters);

	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/articles${query ? `?${query}` : ''}`, {
			method: 'GET',
			next: { revalidate },
		});
}

/**
 * The same listing, for a **client** component - the infinite-scroll feed asking for page
 * two and beyond.
 *
 * Goes through `/api/proxy` (the default request mode) rather than `remote-api`: a browser
 * cannot reach the backend directly, and the proxy is the only sanctioned path from there.
 * No `revalidate` either - a client fetch does not participate in Next's data cache, and
 * TanStack Query is what holds the pages already loaded.
 */
export async function requestPublicArticlesPage(
	params: PublicArticlesParams,
): Promise<ApiResponseFetch<FindFunctionResponseType<ArticleModel>>> {
	const query = buildPublicArticlesQuery(params);

	return await new ApiRequest().doFetch(
		`/public/articles${query ? `?${query}` : ''}`,
		{ method: 'GET' },
	);
}

/**
 * One published article by slug (`GET /public/articles/:slug`), body included.
 *
 * The request is anonymous - nothing here forwards the reader's session - so the backend
 * evaluates an article's visibility rule against no one: a `restricted` article throws
 * (401/403 as an `ApiError`) rather than answering. That is also what makes the response safe
 * to keep in Next's shared data cache, since it can only ever hold what any visitor may read.
 */
export async function requestPublicArticle(params: {
	slug: string;
	language?: Language;
	revalidate?: number;
}): Promise<ApiResponseFetch<ArticleModel>> {
	const { slug, language, revalidate } = params;

	const query = buildQueryString({ language });

	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(
			`/public/articles/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`,
			{
				method: 'GET',
				next: { revalidate },
			},
		);
}

/**
 * Reorders one featured group.
 *
 * `category_id` scopes the `category` group to a subtree and is meaningless for `section`; the
 * backend rejects the pair the other way round. `positions` must be the complete group in the
 * order it should read - the API compares the set against what it finds and refuses a subset.
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
