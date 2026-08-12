import type { CmrModel } from '@/models/cmr.model';
import { displayVehicleLabel, type VehicleModel } from '@/models/vehicle.model';

export type CmrVehicleModel<D = Date | string> = {
	id: number;

	cmr: CmrModel;
	vehicle: VehicleModel;

	vin: string;
	license_plate: string | null;

	notes: string | null;

	created_at: D;
	updated_at: D | null;
	deleted_at: D | null;
};

export function displayCmrVehicleLabel(entry: CmrVehicleModel) {
	return `#${entry.cmr.id} ${displayVehicleLabel(entry.vehicle)}`;
}
