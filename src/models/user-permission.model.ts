export type UserPermissionModel<D = Date | string> = {
	id: number;
	user_id: number;
	permission_id: number;
	created_at: D;
};
