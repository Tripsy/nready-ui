import type { CmrModel } from '@/models/cmr.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import type { WorkSessionModel } from '@/models/work-session.model';

export type CmrSessionModel<D = Date | string> = {
	id: number;

	cmr: CmrModel;
	work_session: WorkSessionModel;

	company_vehicle_auto: CompanyVehicleModel | null;
	company_vehicle_trailer: CompanyVehicleModel | null;

	created_at: D;
};

export type CmrModelWithSessionModel<D = Date | string> = CmrModel<D> & {
	cmr_sessions: CmrSessionModel<D>[];
};

export function displayCmrSessionLabel(entry: CmrSessionModel) {
	return `CMR${entry.cmr.id} ${entry.work_session.user.name}`;
}
