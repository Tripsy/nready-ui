export const PermissionEntitiesSuggestions = [
	'dashboard', // NOT an entity
	'account', // NOT an entity — virtual key for the public account self-service data source (no backend permission gating)
	'address',
	'brand',
	'cash-flow',
	'client',
	'cmr',
	'cmr-session',
	'cmr-vehicle',
	'company-vehicle',
	'cron-history',
	'document-series',
	'image',
	'log-data',
	'log-history',
	'mail-queue',
	'permission',
	'place',
	'template',
	'user',
	'vehicle',
	'vendor',
	'work-session',
	'work-session-vehicle',
] as const;

export const PermissionOperationSuggestions = [
	'create',
	'update',
	'read',
	'find',
	'delete',
	'refund', // TODO not all entities have all the operations
] as const;

export type PermissionEntityType =
	(typeof PermissionEntitiesSuggestions)[number];
export type PermissionOperationType =
	(typeof PermissionOperationSuggestions)[number];

export type PermissionModel<D = Date | string> = {
	id: number;
	entity: PermissionEntityType;
	operation: PermissionOperationType;
	deleted_at: D | undefined;
};
