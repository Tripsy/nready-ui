import Routes from '@/config/routes.setup';
import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
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
 * Remove an image's file from storage. Throws when the route refuses or fails.
 *
 * Call it only after the image row is deleted: the route cannot tell whether a row still
 * references the file. A failure here leaves an orphaned file rather than a broken image, so
 * callers that already deleted the row log it instead of reporting the whole delete as failed.
 *
 * `custom` mode keeps the origin-relative URL, which is what lets `ApiRequest` attach the CSRF
 * header and retry once on a stale token - a tab left open past the cookie's hour would
 * otherwise fail every delete.
 */
export async function removeImageFile(
	path: string,
	storage: ImageStorage,
): Promise<void> {
	await new ApiRequest()
		.setRequestMode('custom')
		.doFetch(Routes.get('api-image'), {
			method: 'DELETE',
			body: JSON.stringify({
				path,
				storage,
			}),
		});
}
