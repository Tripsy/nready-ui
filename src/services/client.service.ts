import { ApiRequest } from '@/helpers/api.helper';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Links a client to an account (dashboard, `PATCH /clients/:id/account`), or unlinks it when
 * `user_id` is null. The backend accepts the link nowhere else - `create` and `update` drop it.
 * The response carries a message and no entry.
 */
export async function requestUpdateClientAccount(
	id: number,
	user_id: number | null,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/clients/${id}/account`, {
		method: 'PATCH',
		body: JSON.stringify({ user_id }),
	});
}
