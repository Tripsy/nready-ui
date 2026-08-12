import { formatDate } from '@/helpers/date.helper';
import type { AddressModel } from '@/models/address.model';
import type { ClientModel } from '@/models/client.model';
import type { StatusTransitions } from '@/types/common.type';

export const CmrStatusEnum = {
	ORDERED: 'ordered',
	PREPARING: 'preparing',
	TRANSIT: 'transit',
	DELIVERED: 'delivered',
	CANCELLED: 'canceled',
	DELAYED: 'delayed',
} as const;

export type CmrStatus = (typeof CmrStatusEnum)[keyof typeof CmrStatusEnum];

// Allowed status transition configuration
export const STATUS_TRANSITIONS: StatusTransitions<CmrStatus> = {
	[CmrStatusEnum.ORDERED]: [
		CmrStatusEnum.PREPARING,
		CmrStatusEnum.TRANSIT,
		CmrStatusEnum.DELIVERED,
		CmrStatusEnum.CANCELLED,
		CmrStatusEnum.DELAYED,
	],
	[CmrStatusEnum.PREPARING]: [
		CmrStatusEnum.TRANSIT,
		CmrStatusEnum.DELIVERED,
		CmrStatusEnum.CANCELLED,
		CmrStatusEnum.DELAYED,
	],
	[CmrStatusEnum.TRANSIT]: [
		CmrStatusEnum.DELIVERED,
		CmrStatusEnum.CANCELLED,
		CmrStatusEnum.DELAYED,
	],
	[CmrStatusEnum.DELIVERED]: [],
	[CmrStatusEnum.CANCELLED]: [],
	[CmrStatusEnum.DELAYED]: [
		CmrStatusEnum.PREPARING,
		CmrStatusEnum.TRANSIT,
		CmrStatusEnum.DELIVERED,
		CmrStatusEnum.CANCELLED,
	],
};

export const CmrTransportTypeEnum = {
	DOMESTIC: 'domestic',
	INTERNATIONAL: 'international',
} as const;

export type CmrTransportType =
	(typeof CmrTransportTypeEnum)[keyof typeof CmrTransportTypeEnum];

export type CmrModel<D = Date | string> = {
	id: number;

	status: CmrStatus;
	transport_type: CmrTransportType;

	client: ClientModel;
	pickup_address: AddressModel;
	delivery_address: AddressModel;

	ref_code: string;
	ref_number: number;

	// tracking
	tracking_number: string;

	// contact
	contact_name: string | null;
	contact_phone: string | null;
	contact_email: string | null;

	// dates
	ordered_at: D | null;
	pick_scheduled_at: D | null;
	estimated_delivery_at: D | null;
	delivered_at: D | null;

	// other
	notes: string | null;

	// client related
	signed_at: D | null;
	signed_by: string | null;
	signed_data: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

/**
 * Zero-padding applied to `ref_number` when it is displayed.
 */
export const CMR_REF_NUMBER_PADDING = 6;

export function formatCmrRefNumber(refNumber: number): string {
	return String(refNumber).padStart(CMR_REF_NUMBER_PADDING, '0');
}

export function displayCmrReference(
	ref_code: string,
	ref_number: number,
): string {
	return `${ref_code}-${formatCmrRefNumber(ref_number)}`;
}

export function displayCmrLabel(entry: CmrModel): string {
	return `${displayCmrReference(entry.ref_code, entry.ref_number)} ${formatDate(entry.ordered_at, 'default')}`;
}
