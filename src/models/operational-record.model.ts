import type {
	CashFlowModel,
	OperationalRecordType,
} from '@/models/cash-flow.model';
import type { ClientModel } from '@/models/client.model';
import type { OrderModel } from '@/models/order.model';
import type { VendorModel } from '@/models/vendor.model';
import type { EntityId } from '@/types/entity-id.type';

export type OperationalRecordModel<D = Date | string> = {
	id: EntityId;

	operational_record_type: OperationalRecordType;
	entity_id: EntityId;

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
