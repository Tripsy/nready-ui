import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import type { ApiResponseFetch } from '@/types/api.type';

export async function createCmrSession<P>(
	params: Partial<P>,
	cmr_id: number,
): Promise<ApiResponseFetch<CmrSessionModel>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('cmr-session')}/${cmr_id}`,
		{
			method: 'POST',
			body: JSON.stringify(params),
		},
	);
}

export async function deleteCmrSession(
	entry: CmrSessionModel,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('cmr-session')}/${entry.cmr.id}/${entry.id}`,
		{
			method: 'DELETE',
		},
	);
}
