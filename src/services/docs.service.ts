import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import type { ApiResponseFetch } from '@/types/api.type';
import type { ApiDocs } from '@/types/api-docs.type';

/**
 * The generated API documentation for one backend feature, keyed by controller action.
 *
 * Gated by the `read` permission on that feature's entity, so a caller who can open the
 * entity's dashboard page can always read its docs. A feature with no `<feature>.docs.ts`
 * answers 404 — today only `discount` is documented.
 */
export async function requestFeatureDocs(feature: string): Promise<ApiDocs> {
	const response: ApiResponseFetch<ApiDocs> = await new ApiRequest().doFetch(
		`/docs/${feature}`,
	);

	return getResponseData(response) ?? { baseUrl: '', actions: {} };
}
