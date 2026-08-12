import type { BrandModel } from '@/models/brand.model';

export const VehicleStatusEnum = {
	DRAFT: 'draft',
	VERIFIED: 'verified',
} as const;

export type VehicleStatus =
	(typeof VehicleStatusEnum)[keyof typeof VehicleStatusEnum];

export const VehicleTypeEnum = {
	AUTO: 'auto',
	MOTO: 'moto',
	TRAILER: 'trailer',
} as const;

export type VehicleType =
	(typeof VehicleTypeEnum)[keyof typeof VehicleTypeEnum];

export type VehicleModel<D = Date | string> = {
	id: number;

	brand: BrandModel<D> | null;
	model: string;

	vehicle_type: VehicleType;
	status: VehicleStatus;

	// details
	length: number | null;
	width: number | null;
	height: number | null;
	weight: number | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export const displayVehicleLabel = (entry: VehicleModel) => {
	return `${entry.brand?.name} ${entry.model}`;
};
