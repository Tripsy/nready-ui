import type { EntityId } from '@/types/entity-id.type';

export const LogHistorySourceEnum = {
	CRON: 'cron',
	API: 'api',
	SEED: 'seed',
	UNKNOWN: 'unknown',
} as const;

export type LogHistorySource =
	(typeof LogHistorySourceEnum)[keyof typeof LogHistorySourceEnum];

// Backend table names, as `log_history.entity` records them
export const LogHistoryEntities = [
	'address',
	'article',
	'brand',
	'carrier',
	'cart',
	'cart_item',
	'cash_flow',
	'category',
	'client',
	'client_address',
	'complaint',
	'discount',
	'document_series',
	'exchange_rate',
	'grn',
	'image',
	'invoice',
	'operational_record',
	'order',
	'order_return',
	'shipping',
	'shipping_line',
	'permission',
	'place',
	'product',
	'review',
	'subscription',
	'template',
	'term',
	'user',
	'vat_rate',
	'vendor',
	'warehouse',
];
export const LogHistoryActions = [
	'created',
	'updated',
	'deleted',
	'removed',
	'restored',
	'status',
	'password_change',
];

export type LogHistoryModel<D = Date | string> = {
	id: EntityId;

	entity: string;
	entity_id: EntityId;
	action: string;

	auth_id: EntityId | null;
	performed_by: string;

	request_id: string;
	source: LogHistorySource;

	recorded_at: D;

	details?: Record<string, unknown>;
};
