import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormApproveOrderReturn,
	type OrderReturnApproveFormValuesType,
} from '@/app/(dashboard)/dashboard/order-return/form-approve-order-return.component';
import {
	FormManageOrderReturn,
	type OrderReturnFormValuesType,
	type OrderReturnLineFormType,
} from '@/app/(dashboard)/dashboard/order-return/form-manage-order-return.component';
import { StatusTransitionOrderReturn } from '@/app/(dashboard)/dashboard/order-return/status-transition-order-return.component';
import { UsageGuideOrderReturn } from '@/app/(dashboard)/dashboard/order-return/usage-guide-order-return.component';
import { ViewOrderReturn } from '@/app/(dashboard)/dashboard/order-return/view-order-return.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
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
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import { displayOrderReference } from '@/models/order.model';
import {
	displayOrderReturnLabel,
	displayOrderReturnReference,
	ORDER_RETURN_LINES_MAX,
	ORDER_RETURN_MANUAL_STATUSES,
	ORDER_RETURN_NOTES_MAX,
	ORDER_RETURN_STATUS_TRANSITIONS,
	type OrderReturnModel,
	type OrderReturnReason,
	OrderReturnReasonEnum,
	type OrderReturnStatus,
	OrderReturnStatusEnum,
} from '@/models/order-return.model';
import {
	ShippingMethodEnum,
	ShippingStatusEnum,
} from '@/models/shipping.model';
import {
	requestApproveOrderReturn,
	requestOrderReturnRefund,
} from '@/services/order-return.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_order_id',
	'invalid_reason',
	'invalid_text',
	'invalid_lines',
	'invalid_quantity',
	'invalid_price',
	'invalid_vat_rate',
	'invalid_method',
	'price_vat_pair',
] as const;

/** Mirrors the backend's `order-return.validator.ts` - see `../nready-api/src/features/order-return`. */
class OrderReturnValidator extends BaseValidator<typeof validatorMessages> {
	private text = () =>
		z
			.string()
			.max(ORDER_RETURN_NOTES_MAX, {
				message: this.getMessage('invalid_text'),
			})
			.nullable();

	/**
	 * A line by variant. Whether the quantity is still returnable is the backend's call - it can see
	 * what other returns claim - and comes back as a 409 naming the variant.
	 */
	private line = () =>
		z.object({
			variant_id: this.validateId(this.getMessage('invalid_quantity')),
			quantity: this.validateNumber(this.getMessage('invalid_quantity'), {
				required: true,
				onlyPositive: true,
				allowDecimals: 2,
			}),
			label: z.string().nullable(),
		});

	manage = () =>
		z.object({
			order_id: this.validateId(this.getMessage('invalid_order_id')),
			reason: this.validateEnum(
				OrderReturnReasonEnum,
				this.getMessage('invalid_reason'),
			),
			customer_notes: this.text(),
			response: this.text(),
			notes: this.text(),
			lines: z
				.array(this.line())
				.min(1, { message: this.getMessage('invalid_lines') })
				.max(ORDER_RETURN_LINES_MAX, {
					message: this.getMessage('invalid_lines'),
				}),
			// Carried through so the parsed output keeps it for `prepareParamsFromFormValues`
			status: z.string().nullable(),
		});

	/** Once decided, only the text around the return can change - the backend refuses the rest. */
	manageDecided = () =>
		z.object({
			customer_notes: this.text(),
			response: this.text(),
			notes: this.text(),
			status: z.string().nullable(),
		});

	approve = () =>
		z
			.object({
				destination_warehouse_id: z.number().nullable(),
				pickup_client_address_id: z.number().nullable(),
				carrier_id: z.number().nullable(),
				method: this.validateEnum(
					ShippingMethodEnum,
					this.getMessage('invalid_method'),
				),
				price: this.validateNumber(this.getMessage('invalid_price'), {
					required: false,
					onlyPositive: false,
					allowDecimals: 2,
				}).refine(
					(value) =>
						value === null || value === undefined || value >= 0,
					{ message: this.getMessage('invalid_price') },
				),
				vat_rate: this.validateNumber(
					this.getMessage('invalid_vat_rate'),
					{
						required: false,
						onlyPositive: false,
						allowDecimals: 2,
					},
				).refine(
					(value) =>
						value === null ||
						value === undefined ||
						(value >= 0 && value <= 100),
					{ message: this.getMessage('invalid_vat_rate') },
				),
				response: this.text(),
			})
			// Stated as a pair, like on a shipment - the backend refuses one without the other
			.superRefine((data, ctx) => {
				if ((data.price === null) !== (data.vat_rate === null)) {
					ctx.addIssue({
						path: ['price'],
						message: this.getMessage('price_vat_pair'),
						code: 'custom',
					});
				}
			});
}

async function getValidator() {
	return new OrderReturnValidator(
		await resolveValidatorMessages(validatorMessages, 'order-return'),
	);
}

const isDecidedStatus = (status: OrderReturnStatus | null): boolean =>
	status !== null && status !== OrderReturnStatusEnum.REQUESTED;

async function validateForm(values: OrderReturnFormValuesType) {
	const validator = await getValidator();

	return isDecidedStatus(values.status)
		? validator.manageDecided().safeParse(values)
		: validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): OrderReturnFormValuesType {
	return {
		order_id: getFormDataAsNumber(formData, 'order_id'),
		reason: getFormDataAsString(formData, 'reason'),
		customer_notes: getFormDataAsString(formData, 'customer_notes'),
		response: getFormDataAsString(formData, 'response'),
		notes: getFormDataAsString(formData, 'notes'),
		lines: getFormDataAsJsonList<OrderReturnLineFormType>(
			formData,
			'lines',
		),
		order: getFormDataAsString(formData, 'order_label'),
		status: (getFormDataAsString(formData, 'status') ||
			null) as OrderReturnStatus | null,
	};
}

function getFormState(
	data?: OrderReturnModel,
): FormStateType<OrderReturnFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			order_id: data?.order_id ?? null,
			reason: data?.reason ?? null,
			customer_notes: data?.customer_notes ?? null,
			response: data?.response ?? null,
			notes: data?.notes ?? null,
			lines:
				data?.lines?.map((line) => ({
					variant_id: line.variant_id,
					quantity: Number(line.quantity),
					label: line.label ?? line.sku ?? null,
				})) ?? [],
			order: data?.order
				? displayOrderReference(data.order)
				: data?.order_id
					? `#${data.order_id}`
					: null,
			status: data?.status ?? null,
		},
	};
}

/**
 * Strips the display-only fields. A create sends the order; an update never does - a return stays
 * with the order it was raised against. Once decided only the text goes out: the backend answers
 * 409 to lines or a reason, rather than dropping them.
 */
function prepareCreateParams(values: OrderReturnFormValuesType) {
	return {
		order_id: values.order_id,
		reason: values.reason as OrderReturnReason,
		customer_notes: values.customer_notes,
		notes: values.notes,
		lines: values.lines.map((line) => ({
			variant_id: line.variant_id,
			quantity: line.quantity,
		})),
	};
}

function prepareUpdateParams(values: OrderReturnFormValuesType) {
	const text = {
		customer_notes: values.customer_notes,
		response: values.response,
		notes: values.notes,
	};

	if (isDecidedStatus(values.status)) {
		return text;
	}

	return {
		...text,
		reason: values.reason as OrderReturnReason,
		lines: values.lines.map((line) => ({
			variant_id: line.variant_id,
			quantity: line.quantity,
		})),
	};
}

async function validateApproveForm(values: OrderReturnApproveFormValuesType) {
	return (await getValidator()).approve().safeParse(values);
}

function getApproveFormValues(
	formData: FormData,
): OrderReturnApproveFormValuesType {
	return {
		destination_warehouse_id: getFormDataAsNumber(
			formData,
			'destination_warehouse_id',
		),
		pickup_client_address_id: getFormDataAsNumber(
			formData,
			'pickup_client_address_id',
		),
		carrier_id: getFormDataAsNumber(formData, 'carrier_id'),
		method: getFormDataAsString(formData, 'method'),
		price: getFormDataAsNumber(formData, 'price'),
		vat_rate: getFormDataAsNumber(formData, 'vat_rate'),
		response: getFormDataAsString(formData, 'response'),
		destination_warehouse: getFormDataAsString(
			formData,
			'destination_warehouse_label',
		),
		pickup_client_address: getFormDataAsString(
			formData,
			'pickup_client_address_label',
		),
		carrier: getFormDataAsString(formData, 'carrier_label'),
		client_id: getFormDataAsNumber(formData, 'client_id'),
	};
}

function getApproveFormState(
	data?: OrderReturnModel,
): FormStateType<OrderReturnApproveFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			destination_warehouse_id: null,
			pickup_client_address_id: null,
			carrier_id: null,
			method: ShippingMethodEnum.COURIER,
			price: null,
			vat_rate: null,
			response: data?.response ?? null,
			destination_warehouse: null,
			pickup_client_address: null,
			carrier: null,
			client_id: data?.order?.client_id ?? null,
		},
	};
}

/** Only what was stated goes out - every field left empty is the backend's to default. */
function prepareApproveParams(values: OrderReturnApproveFormValuesType) {
	return {
		...(values.destination_warehouse_id
			? { destination_warehouse_id: values.destination_warehouse_id }
			: {}),
		...(values.pickup_client_address_id
			? { pickup_client_address_id: values.pickup_client_address_id }
			: {}),
		...(values.carrier_id ? { carrier_id: values.carrier_id } : {}),
		...(values.method
			? {
					method: values.method as (typeof ShippingMethodEnum)[keyof typeof ShippingMethodEnum],
				}
			: {}),
		...(values.price !== null && values.vat_rate !== null
			? { price: values.price, vat_rate: values.vat_rate }
			: {}),
		...(values.response ? { response: values.response } : {}),
	};
}

/** Whether a manual move is left - approve and receive have their own way in. */
const canMoveOrderReturn = (entry: OrderReturnModel): boolean =>
	getStatusTransitions(entry.status, ORDER_RETURN_STATUS_TRANSITIONS).some(
		(status) => ORDER_RETURN_MANUAL_STATUSES.includes(status),
	);

/** A refund is drafted for a received return once; this re-raises it while none is recorded. */
const canDraftRefund = (entry: OrderReturnModel): boolean =>
	(entry.status === OrderReturnStatusEnum.RECEIVED ||
		entry.status === OrderReturnStatusEnum.CLOSED) &&
	(entry.reversal_invoice_ids ?? []).length === 0;

export type OrderReturnDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: OrderReturnStatus | null; matchMode: 'equals' };
	reason: { value: OrderReturnReason | null; matchMode: 'equals' };
	create_date_start: { value: string | null; matchMode: 'equals' };
	create_date_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<OrderReturnModel>
> {
	const [translations, labels, shippingLabels] = await Promise.all([
		translateBatch(
			[
				'create.title',
				'update.title',
				'view.title',
				'delete.title',
				'restore.title',
				'approve.title',
				'refund.title',
				'statusTransition.title',
				'guide.title',
			] as const,
			'order-return.action',
		),
		translateBatch(
			[
				'field.id',
				'field.reference',
				'field.order',
				'field.reason',
				'field.shipping_status',
				'field.status',
				'field.created_at',
				...enumTranslationKeys('enum.reason', OrderReturnReasonEnum),
			] as const,
			'order-return',
		),
		translateBatch(
			[...enumTranslationKeys('status', ShippingStatusEnum)] as const,
			'shipping',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<OrderReturnModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'order-return', 'read')
					? 'view'
					: undefined,
			dataSource: 'order-return',
		};
	}

	/**
	 * The badge opens what the return is waiting on: a request opens the approval, anything with a
	 * manual move left opens the status window, a deleted row offers a restore.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<OrderReturnModel>['displayButton'] {
		return {
			action: (entry: OrderReturnModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'order-return', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'order-return', 'update')) {
					return undefined;
				}

				if (entry.status === OrderReturnStatusEnum.REQUESTED) {
					return 'approve';
				}

				return canMoveOrderReturn(entry)
					? 'statusTransition'
					: undefined;
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
					status: { value: null, matchMode: 'equals' },
					reason: { value: null, matchMode: 'equals' },
					create_date_start: { value: null, matchMode: 'equals' },
					create_date_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies OrderReturnDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: labels['field.id'],
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'ref_number',
					header: labels['field.reference'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayOrderReturnReference(entry),
						}),
				},
				{
					field: 'order_id',
					header: labels['field.order'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.order
								? displayOrderReference(entry.order)
								: `#${entry.order_id}`,
						}),
				},
				{
					field: 'reason',
					header: labels['field.reason'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.reason',
								entry.reason,
							),
						}),
				},
				{
					field: 'shipping_id',
					header: labels['field.shipping_status'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.shipping
								? `#${entry.shipping.id} - ${translateEnumLabel(shippingLabels, 'status', entry.shipping.status)}`
								: '-',
						}),
				},
				{
					field: 'status',
					header: labels['field.status'],
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'order-return',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'created_at',
					header: labels['field.created_at'],
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<OrderReturnModel>('order-return', params),
		},
		displayEntryLabel: (entry: OrderReturnModel) =>
			displayOrderReturnLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageOrderReturn,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['order-return', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: OrderReturnFormValuesType) =>
					requestCreate<
						OrderReturnModel,
						ReturnType<typeof prepareCreateParams>
					>('order-return', prepareCreateParams(params)),
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
				windowComponent: FormManageOrderReturn,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['order-return', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderReturnModel) =>
					!entry.deleted_at &&
					entry.status !== OrderReturnStatusEnum.CANCELED,
				// The listing carries no lines - the form needs them, so it reads the row first
				reloadEntry: (id: number) =>
					requestView<OrderReturnModel>('order-return', id),
				operationFunction: (
					params: OrderReturnFormValuesType,
					id: number,
				) =>
					requestUpdate<
						OrderReturnModel,
						ReturnType<typeof prepareUpdateParams>
					>('order-return', prepareUpdateParams(params), id),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			approve: {
				windowType: 'form',
				windowTitle: translations['approve.title'],
				windowComponent: FormApproveOrderReturn,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['order-return', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderReturnModel) =>
					!entry.deleted_at &&
					entry.status === OrderReturnStatusEnum.REQUESTED,
				operationFunction: async (
					values: OrderReturnApproveFormValuesType,
					id: number,
				): Promise<ApiResponseFetch<Partial<OrderReturnModel>>> =>
					requestApproveOrderReturn(id, prepareApproveParams(values)),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
					icon: Icons.Status.Ok,
				},
				getFormValues: getApproveFormValues,
				validateForm: validateApproveForm,
				getFormState: getApproveFormState,
			},
			refund: {
				windowType: 'action',
				windowTitle: translations['refund.title'],
				permission: ['order-return', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderReturnModel) =>
					!entry.deleted_at && canDraftRefund(entry),
				operationFunction: async (
					entry: OrderReturnModel,
				): Promise<ApiResponseFetch<null>> => {
					const response = await requestOrderReturnRefund(entry.id);

					return response && { ...response, data: null };
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'info',
					icon: Icons.Payment,
				},
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['order-return', 'delete'],
				entriesSelection: 'single',
				// An approved return has moved goods and money; the backend refuses its delete
				customEntryCheck: (entry: OrderReturnModel) =>
					!entry.deleted_at &&
					(entry.status === OrderReturnStatusEnum.REQUESTED ||
						entry.status === OrderReturnStatusEnum.REJECTED ||
						entry.status === OrderReturnStatusEnum.CANCELED),
				operationFunction: (entry: OrderReturnModel) =>
					requestDelete('order-return', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['order-return', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderReturnModel) =>
					!!entry.deleted_at,
				operationFunction: (entry: OrderReturnModel) =>
					requestRestore('order-return', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionOrderReturn,
				permission: ['order-return', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderReturnModel) =>
					!entry.deleted_at && canMoveOrderReturn(entry),
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
				windowComponent: ViewOrderReturn,
				windowConfigProps: {
					size: 'xl2',
				},
				permission: ['order-return', 'read'],
				entriesSelection: 'single',
				reloadEntry: (id: number) =>
					requestView<OrderReturnModel>('order-return', id),
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideOrderReturn,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['order-return', 'read'],
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
