export const PermissionEntitiesSuggestions = [
	'dashboard', // NOT an entity
	'account', // NOT an entity — virtual key for the public account self-service data source (no backend permission gating)
	'address',
	'article',
	'brand',
	'carrier',
	'cash-flow',
	'category',
	'client',
	'comment',
	'cron-history',
	'discount',
	'document-series',
	'grn',
	'image',
	'invoice',
	'log-data',
	'log-history',
	'mail-queue',
	'order',
	'order-shipping',
	'permission',
	'place',
	'product',
	'rating',
	'subscription',
	'template',
	'term',
	'user',
	'vendor',
	'warehouse',
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
