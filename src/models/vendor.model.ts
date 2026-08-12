import type { StatusTransitions } from '@/types/common.type';

export const VendorStatusEnum = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	PENDING: 'pending',
} as const;

export type VendorStatus =
	(typeof VendorStatusEnum)[keyof typeof VendorStatusEnum];

/**
 * What the vendor sells, which is also what it is billed for: `supplier` for goods (fuel, tyres,
 * parts), `provider` for services (insurance, tolls, telematics).
 */
export const VendorTypeEnum = {
	SUPPLIER: 'supplier',
	PROVIDER: 'provider',
} as const;

export type VendorType = (typeof VendorTypeEnum)[keyof typeof VendorTypeEnum];

// Mirrors the column default on the backend entity
export const VENDOR_DEFAULT_TYPE = VendorTypeEnum.SUPPLIER;

// Allowed status transition configuration
export const STATUS_TRANSITIONS: StatusTransitions<VendorStatus> = {
	[VendorStatusEnum.ACTIVE]: [VendorStatusEnum.INACTIVE],
	[VendorStatusEnum.INACTIVE]: [VendorStatusEnum.ACTIVE],
	[VendorStatusEnum.PENDING]: [
		VendorStatusEnum.ACTIVE,
		VendorStatusEnum.INACTIVE,
	],
};

export type VendorModel<D = Date | string> = {
	id: number;

	name: string;
	type: VendorType;
	status: VendorStatus;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export const displayVendorLabel = (entry: VendorModel) => {
	return entry.name;
};
