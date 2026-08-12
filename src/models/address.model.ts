import { displayPlaceLabel, type PlaceModel } from '@/models/place.model';
import type { Language } from '@/types/common.type';

export type AddressModel<D = Date | string> = {
	id: number;

	city: PlaceModel<D> | null;
	details: string;
	postal_code: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

export function displayAddressLabel(
	entry: AddressModel,
	language: Language,
): string {
	if (!entry.city) {
		return entry.details;
	}

	return `${displayPlaceLabel(entry.city, language, false)}, ${entry.details}`;
}
