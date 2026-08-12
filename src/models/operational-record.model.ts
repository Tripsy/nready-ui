import type {
	CashFlowModel,
	OperationalRecordType,
} from '@/models/cash-flow.model';
import type { ClientModel } from '@/models/client.model';
import type { VendorModel } from '@/models/vendor.model';

export type OperationalRecordModel<D = Date | string> = {
	id: number;

	operational_record_type: OperationalRecordType;
	entity_id: number;

	cash_flow: CashFlowModel;
	client: ClientModel | null;
	vendor: VendorModel | null;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};
