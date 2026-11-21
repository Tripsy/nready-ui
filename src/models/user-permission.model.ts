import type { EntityId } from '@/types/entity-id.type';

export type UserPermissionModel<D = Date | string> = {
	id: EntityId;
	user_id: EntityId;
	permission_id: EntityId;
	created_at: D;
};
