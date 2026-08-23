export type CarrierModel<D = Date | string> = {
	id: number;

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
