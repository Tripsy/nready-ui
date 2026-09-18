import { type AddressModel, displayAddressLabel } from '@/models/address.model';
import type { ClientModel } from '@/models/client.model';
import type { Language } from '@/types/common.type';

export const ClientAddressTypeEnum = {
	BILLING: 'billing',
	DELIVERY: 'delivery',
} as const;

export type ClientAddressType =
	(typeof ClientAddressTypeEnum)[keyof typeof ClientAddressTypeEnum];

/**
 * An existing `address` filed against a client as billing or delivery. The address may be shared
 * with other clients; what belongs to this client alone is `details` (flat, floor, apartment
 * number) and `notes` (instructions about reaching it).
 *
 * No `deleted_at`: the backend deletes a client address outright, and keeps the address.
 */
export type ClientAddressModel<D = Date | string> = {
	id: number;

	client_id: number;
	address_id: number;
	type: ClientAddressType;

	details: string | null;
	notes: string | null;

	/** Joined by the read and the listing, with the city in the requested language. */
	address?: AddressModel<D> | null;
	client?: ClientModel<D> | null;

	created_at: D;
	updated_at: D | null;
};

/** The place an address sits in, named by the backend - each level null when the chain stops short. */
export type AddressPlaceNames = {
	city: string | null;
	region: string | null;
	country: string | null;
};

/**
 * A client address as the storefront lists it (`GET /public/client-addresses`): the street data
 * flattened onto `address`, and the place named in `place` rather than as a nested place tree.
 */
export type OwnClientAddressModel<D = Date | string> = Omit<
	ClientAddressModel<D>,
	'address' | 'client'
> & {
	address: {
		id: number;
		city_id: number | null;
		/** Street and number. */
		details: string;
		postal_code: string | null;
	} | null;
	place: AddressPlaceNames;
};

/** One line, most specific first: street, flat, postal code, then the place from city outward. */
export function displayOwnClientAddress(entry: OwnClientAddressModel): string {
	return [
		entry.address?.details,
		entry.details,
		entry.address?.postal_code,
		entry.place.city,
		entry.place.region,
		entry.place.country,
	]
		.filter((part): part is string => !!part)
		.join(', ');
}

export function displayClientAddressLabel(
	entry: ClientAddressModel,
	language: Language,
): string {
	const address = entry.address
		? displayAddressLabel(entry.address, language)
		: `#${entry.address_id}`;

	return entry.details ? `${address}, ${entry.details}` : address;
}
