import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageShipping,
	type ShippingFormValuesType,
} from '@/app/(dashboard)/dashboard/shipping/form-manage-shipping.component';
import { StatusTransitionShipping } from '@/app/(dashboard)/dashboard/shipping/status-transition-shipping.component';
import { UsageGuideShipping } from '@/app/(dashboard)/dashboard/shipping/usage-guide-shipping.component';
import { ViewShipping } from '@/app/(dashboard)/dashboard/shipping/view-shipping.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { toCalendarValue } from '@/helpers/date.helper';
import {
	getFormDataAsJsonList,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import { displayOrderReference } from '@/models/order.model';
import {
	displayShippingDestination,
	displayShippingDocument,
	displayShippingEnd,
	displayShippingLabel,
	SHIPPING_STATUS_TRANSITIONS,
	type ShippingMethod,
	ShippingMethodEnum,
	type ShippingModel,
	type ShippingScope,
	ShippingScopeEnum,
	type ShippingStatus,
} from '@/models/shipping.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_scope',
	'invalid_order_id',
	'invalid_document_ref',
	'invalid_pickup_warehouse_id',
	'invalid_pickup_client_address_id',
	'invalid_destination_warehouse_id',
	'invalid_destination_client_address_id',
	'invalid_carrier_id',
	'invalid_method',
	'invalid_tracking_number',
	'invalid_tracking_url',
	'invalid_price',
	'invalid_operational_cost',
	'invalid_vat_rate',
	'invalid_currency',
	'invalid_contact_name',
	'invalid_contact_phone',
	'invalid_contact_email',
	'invalid_variant_id',
	'invalid_quantity',
] as const;

/** Mirrors the backend's `shipping.validator.ts` - see `../nready-api/src/features/shipping`. */
class ShippingValidator extends BaseValidator<typeof validatorMessages> {
	/**
	 * One line: how much of a variant travels. Whether that variant is on the movement's order, and
	 * whether the quantity is still available across the order's other movements, are data questions
	 * the backend answers - a form holding one document cannot see what another movement claimed.
	 */
	private line = () =>
		z.object({
			variant_id: this.validateId(this.getMessage('invalid_variant_id')),
			product_id: this.validateId(this.getMessage('invalid_variant_id')),
			quantity: this.validateNumber(this.getMessage('invalid_quantity'), {
				required: true,
				onlyPositive: true,
				allowDecimals: 2,
			}),
			notes: z.string().nullable(),
		});

	/**
	 * Every reference is optional here and none is optional in practice: which two ends and which
	 * document a movement needs is decided by its `scope`, and that rule lives in the backend
	 * service rather than being restated as a Zod union that could drift from it. What this schema
	 * still owns is the shape of each field and the figures.
	 */
	manage = () =>
		z.object({
			scope: this.validateEnum(
				ShippingScopeEnum,
				this.getMessage('invalid_scope'),
			),
			order_id: this.validateId(this.getMessage('invalid_order_id'), {
				required: false,
			}),
			document_ref: this.validateId(
				this.getMessage('invalid_document_ref'),
				{ required: false },
			),
			pickup_warehouse_id: this.validateId(
				this.getMessage('invalid_pickup_warehouse_id'),
				{ required: false },
			),
			pickup_client_address_id: this.validateId(
				this.getMessage('invalid_pickup_client_address_id'),
				{ required: false },
			),
			destination_warehouse_id: this.validateId(
				this.getMessage('invalid_destination_warehouse_id'),
				{ required: false },
			),
			destination_client_address_id: this.validateId(
				this.getMessage('invalid_destination_client_address_id'),
				{ required: false },
			),
			carrier_id: this.validateId(this.getMessage('invalid_carrier_id'), {
				required: false,
			}),
			method: this.validateEnum(
				ShippingMethodEnum,
				this.getMessage('invalid_method'),
			),
			tracking_number: z.string().nullable(),
			tracking_url: z.string().nullable(),
			/*
			 * `>= 0` like the backend, not the helper's positive default: a checkout writes its
			 * shipment at zero price and zero VAT, and a stricter form could never save one.
			 */
			price: this.validateNumber(this.getMessage('invalid_price'), {
				required: true,
				onlyPositive: false,
				allowDecimals: 2,
			}).refine((value) => value >= 0, {
				message: this.getMessage('invalid_price'),
			}),
			// Optional and `>= 0`: a self-pickup legitimately costs nothing
			operational_cost: this.validateNumber(
				this.getMessage('invalid_operational_cost'),
				{ required: false, onlyPositive: false, allowDecimals: 2 },
			).refine(
				(value) => value === null || value === undefined || value >= 0,
				{ message: this.getMessage('invalid_operational_cost') },
			),
			vat_rate: this.validateNumber(this.getMessage('invalid_vat_rate'), {
				required: true,
				onlyPositive: false,
				allowDecimals: 2,
			}).refine((value) => value >= 0 && value <= 100, {
				message: this.getMessage('invalid_vat_rate'),
			}),
			currency: this.validateString(this.getMessage('invalid_currency')),
			contact_name: z.string().nullable(),
			contact_phone: z.string().nullable(),
			contact_email: z.string().nullable(),
			estimated_delivery_at: z.string().nullable(),
			notes: z.string().nullable(),
			lines: z.array(this.line()),
		});
}

async function validateForm(values: ShippingFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'shipping.validation',
	);

	const validator = new ShippingValidator(translations);

	return validator.manage().safeParse(values);
}

/**
 * The three autocomplete labels are the visible text and are not submitted on - the backend takes
 * the ids alone. They stay in the form values so a failed submit redraws each box with what was
 * picked.
 */
function getFormValues(formData: FormData): ShippingFormValuesType {
	return {
		scope: getFormDataAsString(formData, 'scope'),
		order_id: getFormDataAsNumber(formData, 'order_id'),
		document_ref: getFormDataAsNumber(formData, 'document_ref'),
		pickup_warehouse_id: getFormDataAsNumber(
			formData,
			'pickup_warehouse_id',
		),
		pickup_client_address_id: getFormDataAsNumber(
			formData,
			'pickup_client_address_id',
		),
		destination_warehouse_id: getFormDataAsNumber(
			formData,
			'destination_warehouse_id',
		),
		destination_client_address_id: getFormDataAsNumber(
			formData,
			'destination_client_address_id',
		),
		carrier_id: getFormDataAsNumber(formData, 'carrier_id'),
		method: getFormDataAsString(formData, 'method'),
		tracking_number: getFormDataAsString(formData, 'tracking_number'),
		tracking_url: getFormDataAsString(formData, 'tracking_url'),
		price: getFormDataAsNumber(formData, 'price'),
		operational_cost: getFormDataAsNumber(formData, 'operational_cost'),
		vat_rate: getFormDataAsNumber(formData, 'vat_rate'),
		currency: getFormDataAsString(formData, 'currency'),
		contact_name: getFormDataAsString(formData, 'contact_name'),
		contact_phone: getFormDataAsString(formData, 'contact_phone'),
		contact_email: getFormDataAsString(formData, 'contact_email'),
		estimated_delivery_at: getFormDataAsString(
			formData,
			'estimated_delivery_at',
		),
		notes: getFormDataAsString(formData, 'notes'),
		lines: getFormDataAsJsonList(formData, 'lines'),
		order: getFormDataAsString(formData, 'order_label'),
		pickup_warehouse: getFormDataAsString(
			formData,
			'pickup_warehouse_label',
		),
		pickup_client_address: getFormDataAsString(
			formData,
			'pickup_client_address_label',
		),
		destination_warehouse: getFormDataAsString(
			formData,
			'destination_warehouse_label',
		),
		destination_client_address: getFormDataAsString(
			formData,
			'destination_client_address_label',
		),
		carrier: getFormDataAsString(formData, 'carrier_label'),
		is_existing: !!getFormDataAsString(formData, 'is_existing'),
	};
}

function getFormState(
	data?: ShippingModel,
): FormStateType<ShippingFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			// A create defaults to the movement a checkout also produces
			scope: data?.scope ?? ShippingScopeEnum.DELIVERY,
			order_id: data?.order_id ?? null,
			document_ref: data?.document_ref ?? null,
			pickup_warehouse_id: data?.pickup_warehouse_id ?? null,
			pickup_client_address_id: data?.pickup_client_address_id ?? null,
			destination_warehouse_id: data?.destination_warehouse_id ?? null,
			destination_client_address_id:
				data?.destination_client_address_id ?? null,
			carrier_id: data?.carrier_id ?? null,
			method: data?.method ?? ShippingMethodEnum.COURIER,
			tracking_number: data?.tracking_number ?? null,
			tracking_url: data?.tracking_url ?? null,
			price: data?.price ?? 0,
			operational_cost: data?.operational_cost ?? null,
			vat_rate: data?.vat_rate ?? 0,
			currency: data?.currency ?? null,
			contact_name: data?.contact_name ?? null,
			contact_phone: data?.contact_phone ?? null,
			contact_email: data?.contact_email ?? null,
			estimated_delivery_at: data?.estimated_delivery_at
				? toCalendarValue(data.estimated_delivery_at)
				: null,
			notes: data?.notes ?? null,
			lines:
				data?.lines?.map((line) => ({
					variant_id: line.variant_id,
					product_id: line.product_id,
					quantity: Number(line.quantity),
					notes: line.notes,
				})) ?? [],
			order: data?.order ? displayOrderReference(data.order) : null,
			pickup_warehouse: data?.pickup_warehouse
				? `${data.pickup_warehouse.code} - ${data.pickup_warehouse.name}`
				: null,
			pickup_client_address: data?.pickup_client_address_id
				? `#${data.pickup_client_address_id}`
				: null,
			destination_warehouse: data?.destination_warehouse
				? `${data.destination_warehouse.code} - ${data.destination_warehouse.name}`
				: null,
			destination_client_address: data?.destination_client_address_id
				? `#${data.destination_client_address_id}`
				: null,
			carrier: data?.carrier?.name ?? null,
			is_existing: !!data,
		},
	};
}

/**
 * Strips the display-only fields; the backend takes the ids alone.
 *
 * `scope` rides along on both actions even though an update ignores it - the backend drops what it
 * will not change, and sending it keeps one payload shape for both.
 */
function prepareParamsFromFormValues(values: ShippingFormValuesType) {
	const {
		order: _order,
		pickup_warehouse: _pickupWarehouse,
		pickup_client_address: _pickupClientAddress,
		destination_warehouse: _destinationWarehouse,
		destination_client_address: _destinationClientAddress,
		carrier: _carrier,
		is_existing: _isExisting,
		...params
	} = values;

	return params;
}

/**
 * Whether the parcel has anywhere left to go. Read from the same transition map the backend
 * enforces, so a terminal state offers nothing here rather than being refused after the click.
 */
const canMoveShipping = (entry: ShippingModel): boolean =>
	getStatusTransitions(entry.status, SHIPPING_STATUS_TRANSITIONS).length > 0;

export type ShippingDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	scope: { value: ShippingScope | null; matchMode: 'equals' };
	status: { value: ShippingStatus | null; matchMode: 'equals' };
	method: { value: ShippingMethod | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ShippingModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'statusTransition.title',
			'guide.title',
		] as const,
		'shipping.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ShippingModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'shipping', 'read') ? 'view' : undefined,
			dataSource: 'shipping',
		};
	}

	/**
	 * The badge opens the transition window rather than acting on one click: most states offer more
	 * than one move, and a deleted row offers a restore instead.
	 *
	 * A parcel in a terminal state offers no action at all, so the badge stops being a button. The
	 * alternative - opening a window that can only refuse - is what "operation not allowed" was.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ShippingModel>['displayButton'] {
		return {
			action: (entry: ShippingModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'shipping', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'shipping', 'update')) {
					return undefined;
				}

				return canMoveShipping(entry) ? 'statusTransition' : undefined;
			},
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					scope: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					method: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies ShippingDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'scope',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.scope),
						}),
				},
				{
					field: 'order_id',
					header: 'Document',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayShippingDocument(entry),
						}),
				},
				{
					// One column for both ends, since which table each names depends on the scope
					// and a reader wants the route rather than two half-empty columns
					field: 'pickup_warehouse_id',
					header: 'Route',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: `${displayShippingEnd(
								entry.pickup_data,
								entry.pickup_warehouse,
								entry.pickup_client_address_id,
							)} → ${displayShippingDestination(entry)}`,
						}),
				},
				{
					field: 'method',
					header: 'Method',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.method),
						}),
				},
				{
					field: 'tracking_number',
					header: 'Tracking',
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'shipping',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'created_at',
					header: 'Created At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<ShippingModel>('shipping', params),
		},
		displayEntryLabel: (entry: ShippingModel) =>
			displayShippingLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageShipping,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['shipping', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: ShippingFormValuesType) =>
					requestCreate<
						ShippingModel,
						ReturnType<typeof prepareParamsFromFormValues>
					>('shipping', prepareParamsFromFormValues(params)),
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageShipping,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['shipping', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ShippingModel) => !entry.deleted_at,
				/*
				 * The listing carries no `lines` - only the read does - so the form has to re-fetch
				 * the row first. Seeding it from the table row would submit an empty allocation and
				 * wipe what the parcel was carrying.
				 */
				reloadEntry: (id: number) =>
					requestView<ShippingModel>('shipping', id),
				operationFunction: (
					params: ShippingFormValuesType,
					id: number,
				) =>
					requestUpdate<
						ShippingModel,
						ReturnType<typeof prepareParamsFromFormValues>
					>('shipping', prepareParamsFromFormValues(params), id),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['shipping', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ShippingModel) => !entry.deleted_at,
				operationFunction: (entry: ShippingModel) =>
					requestDelete('shipping', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['shipping', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ShippingModel) => !!entry.deleted_at,
				operationFunction: (entry: ShippingModel) =>
					requestRestore('shipping', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionShipping,
				permission: ['shipping', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ShippingModel) =>
					!entry.deleted_at && canMoveShipping(entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Action.StatusTransition,
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewShipping,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['shipping', 'read'],
				entriesSelection: 'single',
				// The allocated lines are on the read only, as above
				reloadEntry: (id: number) =>
					requestView<ShippingModel>('shipping', id),
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideShipping,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['shipping', 'read'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Info,
				},
			},
		},
	};
}
