import type {
	CashFlowModel,
	OperationalRecordType,
} from '@/models/cash-flow.model';
import type { ClientModel } from '@/models/client.model';
import type { CmrModel } from '@/models/cmr.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import type { UserModel } from '@/models/user.model';
import type { VendorModel } from '@/models/vendor.model';

export type OperationalRecordModel<D = Date | string> = {
	id: number;

	operational_record_type: OperationalRecordType;
	entity_id: number;

	cash_flow: CashFlowModel;
	client: ClientModel | null;
	employee: UserModel | null;
	vendor: VendorModel | null;
	company_vehicle: CompanyVehicleModel | null;
	cmr: CmrModel | null;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};
