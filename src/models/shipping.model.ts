import type { OrderModel } from '@/models/order.model';
import type { StatusTransitions } from '@/types/common.type';

/**
 * Where a movement has got to, mirroring `ShippingStatusEnum` on `shipping.entity.ts`.
 */
export const ShippingStatusEnum = {
	PENDING: 'pending',
	PREPARING: 'preparing',
	SHIPPED: 'shipped',
	DELIVERED: 'delivered',
	FAILED: 'failed',
	RETURNED: 'returned',
} as const;

export type ShippingStatus =
	(typeof ShippingStatusEnum)[keyof typeof ShippingStatusEnum];

/**
 * What kind of movement this is, and therefore what each end of it names - mirroring
 * `ShippingScopeEnum` on the entity.
 *
 * | scope | pickup | destination | document |
 * |---|---|---|---|
 * | `delivery` | warehouse | client address | `order_id` |
 * | `relocation` | warehouse | warehouse | `document_ref` |
 * | `return` | client address | warehouse | `order_id` |
 *
 * **Fixed once the row exists.** The backend drops a `scope` sent on an update, so a movement of a
 * different kind is a new row rather than an edited one - which is why the form offers it only on
 * create.
 */
export const ShippingScopeEnum = {
	DELIVERY: 'delivery',
	RELOCATION: 'relocation',
	RETURN: 'return',
} as const;

export type ShippingScope =
	(typeof ShippingScopeEnum)[keyof typeof ShippingScopeEnum];

/**
 * How the goods travel, mirroring `ShippingMethodEnum` on the entity. A `self_pickup` still names a
 * warehouse - the one the goods are collected from - so both methods carry an origin.
 */
export const ShippingMethodEnum = {
	SELF_PICKUP: 'self_pickup',
	COURIER: 'courier',
} as const;

export type ShippingMethod =
	(typeof ShippingMethodEnum)[keyof typeof ShippingMethodEnum];

/**
 * Mirrors `STATUS_TRANSITIONS` on the entity.
 *
 * `failed` is reachable from each of the states before arrival, because a movement can go wrong at
 * any of them. The move into `shipped` is the one with a side effect: the backend freezes both ends
 * into `pickup_data` and `destination_data` there, which is why nothing returns to an earlier state.
 *
 * `delivered`, `failed` and `returned` are all terminal - goods that have arrived, gone missing or
 * come back are finished, and anything after that is a new movement.
 */
export const SHIPPING_STATUS_TRANSITIONS: StatusTransitions<ShippingStatus> = {
	[ShippingStatusEnum.PENDING]: [
		ShippingStatusEnum.PREPARING,
		ShippingStatusEnum.FAILED,
	],
	[ShippingStatusEnum.PREPARING]: [
		ShippingStatusEnum.SHIPPED,
		ShippingStatusEnum.FAILED,
	],
	[ShippingStatusEnum.SHIPPED]: [
		ShippingStatusEnum.DELIVERED,
		ShippingStatusEnum.RETURNED,
		ShippingStatusEnum.FAILED,
	],
	[ShippingStatusEnum.DELIVERED]: [],
	[ShippingStatusEnum.FAILED]: [],
	[ShippingStatusEnum.RETURNED]: [],
};

/** What one request may carry, mirroring `SHIPPING_LINES_MAX` in the backend validator. */
export const SHIPPING_LINES_MAX = 200;

/**
 * Which columns each scope uses, mirroring `SCOPE_SHAPE` in `shipping.service.ts`.
 *
 * Both sides need it: the backend to decide what is required, this side to label the two ends and
 * to know which picker to show. Keep the two in step.
 */
export const SHIPPING_SCOPE_SHAPE: Record<
	ShippingScope,
	{
		pickup: 'warehouse' | 'client_address';
		destination: 'warehouse' | 'client_address';
		document: 'order' | 'document_ref';
	}
> = {
	[ShippingScopeEnum.DELIVERY]: {
		pickup: 'warehouse',
		destination: 'client_address',
		document: 'order',
	},
	[ShippingScopeEnum.RELOCATION]: {
		pickup: 'warehouse',
		destination: 'warehouse',
		document: 'document_ref',
	},
	[ShippingScopeEnum.RETURN]: {
		pickup: 'client_address',
		destination: 'warehouse',
		document: 'order',
	},
};

/**
 * One end as it stood when the goods left, frozen by the backend on the move to `shipped`.
 *
 * Null before that. Either end may be a warehouse or a client address and both flatten to this, so
 * a reader does not have to know which it was. The place names are text rather than ids, so a city
 * renamed afterwards does not change what the movement says.
 */
export type ShippingAddressSnapshot = {
	address_country: string | null;
	address_region: string | null;
	address_city: string | null;
	/** Street and number, then the holder's own flat/floor note when there is one. */
	details: string | null;
	postal_code: string | null;
	notes: string | null;
};

/** How much of a variant travels in a given movement. */
export type ShippingLineModel<D = Date | string> = {
	id: number;
	shipping_id: number;
	variant_id: number;
	product_id: number;
	quantity: number;
	notes: string | null;

	/** Attached by the read: the variant's SKU and the product's name, null when unresolved. */
	sku?: string | null;
	label?: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

/**
 * One movement of goods: out to a client, between two warehouses, or back from a client.
 *
 * **`scope` decides what every other reference means** - which of the four end columns is set, and
 * whether the document is `order_id` or `document_ref`. The pair the scope has no use for is always
 * null, so reading the wrong one gives nothing rather than something misleading.
 *
 * **A document may have several movements.** The goods of one order can sit in two places, so the
 * site they leave from is recorded per movement, and `lines` says what travelled in this one.
 *
 * `lines` comes from the read endpoint only - the listing joins the order, both warehouse ends and
 * the carrier and stops there. A detail window re-reads the row to get them.
 */
export type ShippingModel<D = Date | string> = {
	id: number;

	scope: ShippingScope;
	/** The order a `delivery` or a `return` serves; null on a `relocation`. */
	order_id: number | null;
	/** The relocation document, which has no table yet - so nothing resolves it. */
	document_ref: number | null;

	status: ShippingStatus;
	method: ShippingMethod;
	carrier_id: number | null;

	pickup_warehouse_id: number | null;
	pickup_client_address_id: number | null;
	destination_warehouse_id: number | null;
	destination_client_address_id: number | null;

	pickup_data: ShippingAddressSnapshot | null;
	destination_data: ShippingAddressSnapshot | null;

	tracking_number: string | null;
	tracking_url: string | null;

	vat_rate: number;
	price: number;
	currency: string;
	exchange_rate: number;
	/**
	 * What the movement cost the business, in the base currency (`app.currency`) rather than
	 * `currency` above. Null until the back office records it - zero is a real figure.
	 */
	operational_cost: number | null;

	contact_name: string | null;
	contact_phone: string | null;
	contact_email: string | null;

	shipped_at: D | null;
	delivered_at: D | null;
	estimated_delivery_at: D | null;
	notes: string | null;

	/** The narrow selects the backend joins onto a listing row. */
	order?: Pick<
		OrderModel<D>,
		'id' | 'client_id' | 'ref_code' | 'ref_number' | 'status'
	> | null;
	pickup_warehouse?: { id: number; code: string; name: string } | null;
	destination_warehouse?: { id: number; code: string; name: string } | null;
	carrier?: { id: number; name: string } | null;

	lines?: ShippingLineModel<D>[];

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

/** The movement as a person cites it - the tracking number when there is one, the id otherwise. */
export const displayShippingLabel = (entry: ShippingModel): string =>
	entry.tracking_number ?? `#${entry.id}`;

/** The document a movement answers to, whichever kind its scope uses. */
export const displayShippingDocument = (entry: ShippingModel): string => {
	if (entry.order) {
		return `${entry.order.ref_code}-${entry.order.ref_number}`;
	}

	if (entry.order_id) {
		return `#${entry.order_id}`;
	}

	return entry.document_ref ? `Doc #${entry.document_ref}` : '-';
};

/**
 * One end of a movement in words, preferring the frozen copy once there is one.
 *
 * Before dispatch the live reference is the better answer - a correction still reaches the goods -
 * so an unfrozen end reports the row it points at rather than pretending to be a snapshot.
 */
export const displayShippingEnd = (
	snapshot: ShippingAddressSnapshot | null,
	warehouse: { code: string; name: string } | null | undefined,
	clientAddressId: number | null,
): string => {
	if (snapshot) {
		return (
			[
				snapshot.details,
				snapshot.address_city,
				snapshot.address_region,
				snapshot.address_country,
				snapshot.postal_code,
			]
				.filter((part): part is string => !!part)
				.join(', ') || '-'
		);
	}

	if (warehouse) {
		return `${warehouse.code} - ${warehouse.name}`;
	}

	return clientAddressId ? `Client address #${clientAddressId}` : '-';
};

/**
 * Where a movement is headed, in words. A `self_pickup` delivery has no destination by design -
 * the client collects at the pickup warehouse - so it says that rather than a bare dash that reads
 * as missing data.
 */
export const displayShippingDestination = (
	entry: Pick<
		ShippingModel,
		| 'scope'
		| 'method'
		| 'destination_data'
		| 'destination_warehouse'
		| 'destination_client_address_id'
	>,
): string => {
	if (
		entry.scope === ShippingScopeEnum.DELIVERY &&
		entry.method === ShippingMethodEnum.SELF_PICKUP
	) {
		return 'Collected by the client';
	}

	return displayShippingEnd(
		entry.destination_data,
		entry.destination_warehouse,
		entry.destination_client_address_id,
	);
};
