import type { VehicleModel } from '@/models/vehicle.model';
import type { StatusTransitions } from '@/types/common.type';

export const CompanyVehicleStatusEnum = {
	IN_USE: 'in_use',
	DAMAGED: 'damaged',
	SOLD: 'sold',
	SCRAPPED: 'scrapped',
} as const;

export type CompanyVehicleStatus =
	(typeof CompanyVehicleStatusEnum)[keyof typeof CompanyVehicleStatusEnum];

// Allowed status transition configuration
export const STATUS_TRANSITIONS: StatusTransitions<CompanyVehicleStatus> = {
	[CompanyVehicleStatusEnum.IN_USE]: [
		CompanyVehicleStatusEnum.DAMAGED,
		CompanyVehicleStatusEnum.SOLD,
		CompanyVehicleStatusEnum.SCRAPPED,
	],
	[CompanyVehicleStatusEnum.DAMAGED]: [
		CompanyVehicleStatusEnum.IN_USE,
		CompanyVehicleStatusEnum.SOLD,
		CompanyVehicleStatusEnum.SCRAPPED,
	],
	[CompanyVehicleStatusEnum.SOLD]: [],
	[CompanyVehicleStatusEnum.SCRAPPED]: [],
};

export const CompanyVehicleScopeEnum = {
	PERSONAL: 'personal',
	OPERATIONAL: 'operational',
} as const;

export type CompanyVehicleScope =
	(typeof CompanyVehicleScopeEnum)[keyof typeof CompanyVehicleScopeEnum];

export type CompanyVehicleModel<D = Date | string> = {
	id: number;

	vehicle: VehicleModel;

	status: CompanyVehicleStatus;
	scope: CompanyVehicleScope;

	license_plate: string | null;
	vin: string | null;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export function displayCompanyVehicleLabel(entry: CompanyVehicleModel): string {
	return `${entry.vehicle.model} ${entry.license_plate}`;
}
