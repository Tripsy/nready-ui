export const PermissionEntitiesSuggestions = [
	'dashboard', // NOT an entity
	'account', // NOT an entity - virtual key for the public account self-service data source (no backend permission gating)
	'address',
	'article',
	'brand',
	'carrier',
	'cart',
	'cash-flow',
	'category',
	'client',
	'comment',
	'complaint',
	'cron-history',
	'discount',
	'document-series',
	'exchange-rate',
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
	'review',
	'subscription',
	'template',
	'term',
	'user',
	'vendor',
	'warehouse',
] as const;

export type PermissionEntityType =
	(typeof PermissionEntitiesSuggestions)[number];

/** The five every entity gates - what the backend's `PolicyAbstract` checks. */
const CrudOperations = ['create', 'update', 'read', 'find', 'delete'] as const;

/**
 * Operations beyond the CRUD five, keyed by the entity that gates them. `cash-flow` is the only
 * one: `CashFlowPolicy.canRefund` checks `refund` and no other policy does, so offering it for
 * every entity would let an admin grant a row nothing will ever read.
 */
const ExtraOperations = {
	'cash-flow': ['refund'],
} as const satisfies Partial<Record<PermissionEntityType, readonly string[]>>;

export type PermissionOperationType =
	| (typeof CrudOperations)[number]
	| (typeof ExtraOperations)[keyof typeof ExtraOperations][number];

/**
 * The operations valid for one entity - the CRUD five plus whatever it adds. Correlating the two
 * is what makes `['user', 'refund']` a compile error rather than a permission row no policy reads.
 */
export type PermissionOperationFor<E extends PermissionEntityType> =
	| (typeof CrudOperations)[number]
	| (E extends keyof typeof ExtraOperations
			? (typeof ExtraOperations)[E][number]
			: never);

/**
 * Autocomplete source for the permission form, narrowed to the entity being granted. Takes a
 * plain string because the field holds free text until it is submitted.
 */
export function permissionOperationsFor(
	entity: string | null,
): readonly PermissionOperationType[] {
	/*
	 * `Object.hasOwn` rather than `in`, which walks the prototype chain: the entity arrives as
	 * free text from the form, and `toString` would otherwise resolve to a function and throw
	 * when it is spread below.
	 */
	const extra =
		entity && Object.hasOwn(ExtraOperations, entity)
			? ExtraOperations[entity as keyof typeof ExtraOperations]
			: undefined;

	return extra ? [...CrudOperations, ...extra] : CrudOperations;
}

export type PermissionModel<D = Date | string> = {
	id: number;
	entity: PermissionEntityType;
	operation: PermissionOperationType;
	deleted_at: D | undefined;
};
