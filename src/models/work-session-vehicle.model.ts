import {
	type CompanyVehicleModel,
	displayCompanyVehicleLabel,
} from '@/models/company-vehicle.model';
import type { WorkSessionModel } from '@/models/work-session.model';

export const WorkSessionVehicleStatusEnum = {
	ASSIGNED: 'assigned',
	RETURNED: 'returned',
} as const;

export type WorkSessionVehicleStatus =
	(typeof WorkSessionVehicleStatusEnum)[keyof typeof WorkSessionVehicleStatusEnum];

export type WorkSessionVehicleModel<D = Date | string> = {
	id: number;

	work_session: WorkSessionModel;
	company_vehicle: CompanyVehicleModel;

	vehicle_km_start: number;
	vehicle_km_end: number | null;

	status: WorkSessionVehicleStatus;

	assigned_at: D;
	returned_at: D | null;

	notes: string | null;

	created_at: D;
	updated_at: D | null;
};

export function displayWorkSessionVehicleLabel(entry: WorkSessionVehicleModel) {
	return `#${entry.work_session.id} ${displayCompanyVehicleLabel(entry.company_vehicle)}`;
}
