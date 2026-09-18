import { ApiRequest } from '@/helpers/api.helper';
import type { AddressModel } from '@/models/address.model';
import type {
	ClientAddressType,
	OwnClientAddressModel,
} from '@/models/client-address.model';
import type { PlaceModel } from '@/models/place.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The shopper's own addresses (`/public/client-addresses`) and the two searches the add form types
 * into (`/public/addresses`, `/public/places`). The address calls need a session - every filed row
 * is reached through a client the account holds. All of them go through `/api/proxy`.
 */

/**
 * What adding an address carries: either `address_id` (an address picked from the search) or
 * `city_id` + `street` (+ `postal_code`) for a new one - the backend refuses both at once.
 * `details` is the flat, floor or apartment; `notes` the instructions. There is no update.
 */
export type OwnClientAddressParams = {
	address_id?: number;
	city_id?: number;
	street?: string;
	postal_code?: string | null;
	details?: string | null;
	notes?: string | null;
};

/** One client's addresses, newest first, with the city, region and country named. */
export async function requestOwnClientAddresses(
	clientId: number,
	type?: ClientAddressType,
): Promise<ApiResponseFetch<{ entries: OwnClientAddressModel[] }>> {
	const query = new URLSearchParams({ client_id: String(clientId) });

	if (type) {
		query.set('type', type);
	}

	return await new ApiRequest().doFetch(
		`/public/client-addresses?${query.toString()}`,
		{ method: 'GET' },
	);
}

export async function requestCreateOwnClientAddress(
	params: OwnClientAddressParams & {
		client_id: number;
		type: ClientAddressType;
	},
): Promise<ApiResponseFetch<OwnClientAddressModel>> {
	return await new ApiRequest().doFetch('/public/client-addresses', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Addresses by street or postal code, each with its city and the city's parent. Searches the whole
 * address table - the same set the dashboard picker searches - and needs a session.
 */
export async function requestPublicAddresses(
	term: string,
): Promise<ApiResponseFetch<{ entries: AddressModel[] }>> {
	const query = new URLSearchParams({ term });

	return await new ApiRequest().doFetch(
		`/public/addresses?${query.toString()}`,
		{ method: 'GET' },
	);
}

/**
 * Cities by name, each with its parent region or country so two of the same name can be told
 * apart. Public on the backend - place names are reference data - and capped at one short page.
 */
export async function requestPublicCities(
	term: string,
): Promise<ApiResponseFetch<{ entries: PlaceModel[] }>> {
	const query = new URLSearchParams({ term });

	return await new ApiRequest().doFetch(
		`/public/places?${query.toString()}`,
		{ method: 'GET' },
	);
}
