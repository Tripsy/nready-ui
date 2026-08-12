import Routes from '@/config/routes.setup';
import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import { CSRF_HEADER, getCsrfToken } from '@/helpers/csrf.helper';
import type {
	ImageModel,
	ImageSection,
	ImageStorage,
} from '@/models/image.model';
import type { ApiResponseFetch } from '@/types/api.type';

export async function createImage<P>(
	params: Partial<P>,
	section: ImageSection,
	entity_id: number,
): Promise<ApiResponseFetch<ImageModel>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('image')}/${section}/${entity_id}`,
		{
			method: 'POST',
			body: JSON.stringify(params),
		},
	);
}

export async function orderUpdate(
	section: ImageSection,
	entity_id: number,
	positions: { id: number; sort_order: number }[],
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('image')}/${section}/${entity_id}/order`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				positions,
			}),
		},
	);
}

/**
 * Remove image file from storage
 *
 * @param path
 * @param storage
 * @param section
 */
export async function removeImageFile(
	path: string,
	storage: ImageStorage,
	section: ImageSection,
) {
	await fetch(Routes.get('api-image'), {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
			// Raw fetch rather than ApiRequest, so the CSRF header the middleware requires
			// on mutating /api/* requests has to be set by hand.
			[CSRF_HEADER]: await getCsrfToken(),
		},
		body: JSON.stringify({
			path,
			storage,
			section,
		}),
	});
}
