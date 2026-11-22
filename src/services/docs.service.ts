import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import type { ApiResponseFetch } from '@/types/api.type';
import type { ApiDocs } from '@/types/api-docs.type';

const EMPTY_DOCS: ApiDocs = {
	baseUrl: '',
	feature: '',
	entity: '',
	basePath: '',
	authorization: 'required',
	actions: {},
};

/**
 * Client-safe: the usage guide's docs tabs call this from the browser. The admin page reads go
 * through `docs-admin.service.ts`, which needs `next/headers` and must stay out of client bundles.
 *
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
