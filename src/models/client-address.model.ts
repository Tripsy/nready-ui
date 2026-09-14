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

export function displayClientAddressLabel(
	entry: ClientAddressModel,
	language: Language,
): string {
	const address = entry.address
		? displayAddressLabel(entry.address, language)
		: `#${entry.address_id}`;

	return entry.details ? `${address}, ${entry.details}` : address;
}
