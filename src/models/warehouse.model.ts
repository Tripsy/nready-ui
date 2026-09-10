import type { AddressModel } from '@/models/address.model';
import type { StatusTransitions } from '@/types/common.type';

export const WarehouseStatusEnum = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
} as const;

export type WarehouseStatus =
	(typeof WarehouseStatusEnum)[keyof typeof WarehouseStatusEnum];

// Allowed status transition configuration
export const STATUS_TRANSITIONS: StatusTransitions<WarehouseStatus> = {
	[WarehouseStatusEnum.ACTIVE]: [WarehouseStatusEnum.INACTIVE],
	[WarehouseStatusEnum.INACTIVE]: [WarehouseStatusEnum.ACTIVE],
};

/** Mirrors `varchar(16)` on the backend `warehouse.code` column. */
export const WAREHOUSE_CODE_MAX_LENGTH = 16;

/**
 * A warehouse is where stock is held and the origin an order ships from - the second job is why
 * a business tracking no stock at all still has one.
 *
 * `address` is the row the backend joins onto every read, and it is narrower than a full address
 * from the address endpoint: the select carries `city_id` but not the joined city, so a label
 * built from it falls back to the street line.
 */
export type WarehouseModel<D = Date | string> = {
	id: number;

	address_id: number;
	code: string;
	name: string;
	status: WarehouseStatus;
	is_default: boolean;
	notes: string | null;

	address: AddressModel<D> | null;

	created_at: D;
	updated_at: D;
	deleted_at: D | null;
};

export const displayWarehouseLabel = (entry: WarehouseModel) => {
	return `${entry.code} - ${entry.name}`;
};
