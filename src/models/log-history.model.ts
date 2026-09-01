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
	'cash_flow',
	'category',
	'client',
	'complaint',
	'discount',
	'document_series',
	'exchange_rate',
	'grn',
	'image',
	'invoice',
	'order',
	'order_shipping',
	'permission',
	'place',
	'product',
	'subscription',
	'template',
	'term',
	'user',
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
	id: number;

	entity: string;
	entity_id: number;
	action: string;

	auth_id: number | null;
	performed_by: string;

	request_id: string;
	source: LogHistorySource;

	recorded_at: D;

	details?: Record<string, unknown>;
};

export function logHistoryActionMeaning(action: string) {
	switch (action) {
		case 'status':
			return 'status updated';
		case 'password_change':
			return 'password changed';
		default:
			return action;
	}
}
