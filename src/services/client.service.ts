import { ApiRequest } from '@/helpers/api.helper';
import type { ClientModel, ClientType } from '@/models/client.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The shopper's own clients (`/public/clients`) - who an order may be billed to. Both calls need a
 * session: every row is the caller's own, and `POST /public/cart/checkout` accepts no other
 * client. They go through `/api/proxy` (the default request mode) so the backend reads the account
 * from the session the proxy attaches.
 */

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

/**
 * The bill-to choices at checkout, newest first. An empty list means the shopper has to add one
 * with `requestCreateOwnClient` before checking out.
 */
export async function requestOwnClients(): Promise<
	ApiResponseFetch<{ entries: ClientModel[] }>
> {
	return await new ApiRequest().doFetch('/public/clients', {
		method: 'GET',
	});
}

/**
 * The payload for a shopper-created client. The owner is never sent - it is the signed-in account.
 * `person_identification_number` is refused by the backend on this route.
 */
export type OwnClientCreateParams = {
	client_type: ClientType;
	company_name?: string | null;
	company_cui?: string | null;
	company_reg_com?: string | null;
	person_name?: string | null;
	iban?: string | null;
	bank_name?: string | null;
	contact_name?: string | null;
	contact_email?: string | null;
	contact_phone?: string | null;
	notes?: string | null;
};

/**
 * Adds a client linked to the signed-in account. A company already on file under the same name,
 * CUI or registration number answers 409 - linking that one is an operator's action.
 */
export async function requestCreateOwnClient(
	params: OwnClientCreateParams,
): Promise<ApiResponseFetch<ClientModel>> {
	return await new ApiRequest().doFetch('/public/clients', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Updates one of the signed-in account's own clients. Somebody else's id answers 404, the same as a
 * missing one. Partial - `client_type` defaults to the stored one on the backend - and the same
 * 409 as create applies when a company's name, CUI or registration number is already on file.
 */
export async function requestUpdateOwnClient(
	id: number,
	params: Partial<OwnClientCreateParams>,
): Promise<ApiResponseFetch<ClientModel>> {
	return await new ApiRequest().doFetch(`/public/clients/${id}`, {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}
