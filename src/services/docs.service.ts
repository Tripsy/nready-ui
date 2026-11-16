import { Configuration } from '@/config/settings.config';
import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import { getCookie } from '@/helpers/session.helper';
import { apiHeaders } from '@/helpers/system.helper';
import type { ApiResponseFetch } from '@/types/api.type';
import type { ApiDocs, ApiDocsCatalogue } from '@/types/api-docs.type';

/**
 * A server-side docs request as the signed-in admin: `GET /public/api-docs` is admin only despite
 * its path (`ApiDocsPolicy` in `nready-api`), so the session token and the client headers the
 * backend checks it against ride along. The middleware has already refused a non-admin the
 * `/api-docs` pages, so a missing token here only happens if the session ended mid-request.
 *
 * Not cached in Next's data cache: the response is keyed to a caller's token, and the payload
 * changes only on deploy, so the cost is one backend round trip per page view by an admin.
 */
async function adminDocsRequestInit(): Promise<RequestInit> {
	const token = await getCookie(Configuration.get('user.sessionToken'));

	return {
		method: 'GET',
		cache: 'no-store',
		headers: {
			...(token && { Authorization: `Bearer ${token}` }),
			...(await apiHeaders()),
		},
	};
}

const EMPTY_DOCS: ApiDocs = {
	baseUrl: '',
	feature: '',
	entity: '',
	basePath: '',
	authorization: 'required',
	actions: {},
};

/**
 * The generated API documentation for one backend route module, fetched through the proxy so the
 * caller's session rides along - the endpoint is admin only, which is why the dashboard's usage
 * guide renders its docs tabs for an admin alone.
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
 * The whole catalog - every documented route module with its endpoints listed but not
 * described - in one response, which is what lets `/api-docs` render its index without a request
 * per feature.
 *
 * Server-side only, via `remote-api`, with the admin's session (`adminDocsRequestInit`).
 */
export async function requestDocsCatalogue(): Promise<
	ApiDocsCatalogue | undefined
> {
	const response: ApiResponseFetch<ApiDocsCatalogue> = await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch('/public/api-docs', await adminDocsRequestInit());

	return getResponseData(response);
}

/**
 * One route module's documentation, server-side, for the `/api-docs/:feature` page.
 *
 * Throws rather than swallowing, because the caller has to tell an undocumented name (404,
 * and a real `notFound()`) from a backend that is down (which must not answer 404 - that
 * would report an existing page as gone).
 */
export async function requestAdminFeatureDocs(
	feature: string,
): Promise<ApiDocs | undefined> {
	const response: ApiResponseFetch<ApiDocs> = await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(
			`/public/api-docs/${encodeURIComponent(feature)}`,
			await adminDocsRequestInit(),
		);

	return getResponseData(response);
}
