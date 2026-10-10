import type {
	CashFlowModel,
	OperationalRecordType,
} from '@/models/cash-flow.model';
import type { ClientModel } from '@/models/client.model';
import type { OrderModel } from '@/models/order.model';
import type { VendorModel } from '@/models/vendor.model';

export type OperationalRecordModel<D = Date | string> = {
	id: number;

	operational_record_type: OperationalRecordType;
	entity_id: number;

	cash_flow: CashFlowModel;
	client: ClientModel | null;
	vendor: VendorModel | null;
	// The reference alone - the API caches the records under the movement, so nothing that moves
	order: Pick<OrderModel, 'id' | 'ref_code' | 'ref_number'> | null;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};
