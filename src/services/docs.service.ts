import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import type { ApiResponseFetch } from '@/types/api.type';
import type { ApiDocs, ApiDocsCatalogue } from '@/types/api-docs.type';

/**
 * How long a docs response may be served from Next's data cache.
 *
 * The backend fills its documentation registry once, at boot, from the `<module>.docs.ts`
 * files — so the payload changes on deploy and never between requests. An hour keeps a
 * restarted backend from being misreported for long without making every visit a round trip.
 */
export const DOCS_REVALIDATE_SECONDS = 3600;

const EMPTY_DOCS: ApiDocs = {
	baseUrl: '',
	feature: '',
	entity: '',
	basePath: '',
	authorization: 'required',
	actions: {},
};

/**
 * The generated API documentation for one backend route module, fetched through the proxy for
 * a signed-in caller. `GET /public/api-docs/:feature` is open, so this needs no permission — it goes
 * through the proxy only because it is called from a client component (the dashboard's usage
 * guide), which cannot reach the backend directly.
 *
 * A module with no `<module>.docs.ts` answers 404, which surfaces as an empty action map.
 */
export async function requestFeatureDocs(feature: string): Promise<ApiDocs> {
	const response: ApiResponseFetch<ApiDocs> = await new ApiRequest().doFetch(
		`/public/api-docs/${feature}`,
	);

	return getResponseData(response) ?? EMPTY_DOCS;
}

/**
 * The whole catalog — every documented route module with its endpoints listed but not
 * described — in one response, which is what lets `/api-docs` render its index without a request
 * per feature.
 *
 * Server-side only, via `remote-api`: the public docs pages have no visitor to authenticate,
 * and going straight to the backend lets the response participate in Next's data cache.
 */
export async function requestDocsCatalogue(): Promise<
	ApiDocsCatalogue | undefined
> {
	const response: ApiResponseFetch<ApiDocsCatalogue> = await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch('/public/api-docs', {
			method: 'GET',
			next: { revalidate: DOCS_REVALIDATE_SECONDS },
		});

	return getResponseData(response);
}

/**
 * One route module's documentation, server-side, for the `/api-docs/:feature` page.
 *
 * Throws rather than swallowing, because the caller has to tell an undocumented name (404,
 * and a real `notFound()`) from a backend that is down (which must not answer 404 — that
 * would tell a crawler an existing page is gone).
 */
export async function requestPublicFeatureDocs(
	feature: string,
): Promise<ApiDocs | undefined> {
	const response: ApiResponseFetch<ApiDocs> = await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/api-docs/${encodeURIComponent(feature)}`, {
			method: 'GET',
			next: { revalidate: DOCS_REVALIDATE_SECONDS },
		});

	return getResponseData(response);
}
