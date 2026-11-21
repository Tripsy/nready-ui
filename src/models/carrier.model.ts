import type { EntityId } from '@/types/entity-id.type';

export type CarrierModel<D = Date | string> = {
	id: EntityId;

	name: string;
	website: string | null;
	phone: string | null;
	email: string | null;
	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export const displayCarrierLabel = (entry: CarrierModel) => {
	return entry.name;
};
