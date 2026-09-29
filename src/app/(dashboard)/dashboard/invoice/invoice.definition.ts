import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormAllocatePaymentInvoice,
	type InvoiceAllocatePaymentFormValuesType,
} from '@/app/(dashboard)/dashboard/invoice/form-allocate-payment-invoice.component';
import {
	FormCreateInvoice,
	type InvoiceCreateFormValuesType,
} from '@/app/(dashboard)/dashboard/invoice/form-create-invoice.component';
import {
	FormUpdateInvoice,
	type InvoiceUpdateFormValuesType,
} from '@/app/(dashboard)/dashboard/invoice/form-update-invoice.component';
import { ManageInvoice } from '@/app/(dashboard)/dashboard/invoice/manage-invoice.component';
import { UsageGuideInvoice } from '@/app/(dashboard)/dashboard/invoice/usage-guide-invoice.component';
import { ViewInvoice } from '@/app/(dashboard)/dashboard/invoice/view-invoice.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { toCalendarValue } from '@/helpers/date.helper';
import { DisplayAmount } from '@/helpers/display.helper';
import {
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestUpdate,
	requestUpdateStatus,
	requestView,
} from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayInvoiceLabel,
	type InvoiceModel,
	type InvoicePaymentStatus,
	type InvoiceStatus,
	InvoiceStatusEnum,
	type InvoiceType,
	InvoiceTypeEnum,
	MUTABLE_STATUSES,
	STATUS_TRANSITIONS,
} from '@/models/invoice.model';
import { displayOrderReference } from '@/models/order.model';
import {
	requestInvoiceCreditNote,
	requestInvoicePaymentCreate,
} from '@/services/invoice.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Currency } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_order_id',
	'invalid_due_at',
	'invalid_notes',
	'invalid_cash_flow_id',
	'invalid_amount',
] as const;

class InvoiceValidator extends BaseValidator<typeof validatorMessages> {
	private dueAt() {
		return this.validateDate(this.getMessage('invalid_due_at'), {
			required: false,
		});
	}

	private notes() {
		return this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		});
	}

	/**
	 * The document is raised from an order; its lines are generated from that order. No `type`:
	 * `charge` is the only one the API raises this way, and it applies that default itself.
	 */
	create = z.object({
		order_id: this.validateId(this.getMessage('invalid_order_id')),
		due_at: this.dueAt(),
		notes: this.notes(),
	});

	/**
	 * Deliberately short, and it mirrors the backend: the money on a document comes from its
	 * lines, so a total is never submitted, and the currency cannot change - every stored figure
	 * is quoted in it.
	 */
	update = z.object({
		due_at: this.dueAt(),
		notes: this.notes(),
	});

	allocatePayment = z.object({
		cash_flow_id: this.validateId(this.getMessage('invalid_cash_flow_id')),
		amount: this.validateNumber(this.getMessage('invalid_amount'), {
			required: true,
			onlyPositive: true,
			allowDecimals: 2,
		}),
		notes: this.notes(),
	});
}

async function buildValidator() {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'invoice',
	);

	return new InvoiceValidator(translations);
}

type InvoiceCreateOutput = ValidatorOutput<InvoiceValidator, 'create'>;
type InvoiceUpdateOutput = ValidatorOutput<InvoiceValidator, 'update'>;
type InvoiceAllocatePaymentOutput = ValidatorOutput<
	InvoiceValidator,
	'allocatePayment'
>;

export type InvoiceDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	order_id: { value: number | null; matchMode: 'equals' };
	status: { value: InvoiceStatus | null; matchMode: 'equals' };
	payment_status: { value: InvoicePaymentStatus | null; matchMode: 'equals' };
	type: { value: InvoiceType | null; matchMode: 'equals' };
	currency: { value: Currency | null; matchMode: 'equals' };
	is_overdue: { value: boolean | null; matchMode: 'equals' };
	issued_at_start: { value: string | null; matchMode: 'equals' };
	issued_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<InvoiceModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'viewOrder.title',
			'delete.title',
			'issue.title',
			'cancel.title',
			'creditNote.title',
			'allocatePayment.title',
			'manage.title',
			'guide.title',
		] as const,
		'invoice.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<InvoiceModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'invoice', 'read') ? 'view' : undefined,
		};
	}

	/**
	 * Through to the order the document bills. `alternateEntryId` is what makes the window load
	 * that order rather than an invoice of the same id.
	 */
	function displayButtonViewOrder(
		auth: AccountModel | null,
		entry: InvoiceModel,
	): DataTableValueOptionsType<InvoiceModel>['displayButton'] {
		return {
			action: () =>
				// A document raised from a bare cash flow entry has no order to open
				entry.order_id && hasPermission(auth, 'order', 'read')
					? 'view'
					: undefined,
			dataSource: 'order',
			title: translations['viewOrder.title'],
			alternateEntryId: entry.order_id ?? undefined,
		};
	}

	/**
	 * The status cell offers the one move the document can still make: a draft is issued, an
	 * issued document can only be invalidated. `STATUS_TRANSITIONS` decides, so a status with
	 * nothing left (`canceled`) shows no button at all.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<InvoiceModel>['displayButton'] {
		return {
			action: (entry: InvoiceModel) => {
				if (entry.deleted_at) {
					return undefined;
				}

				if (!hasPermission(auth, 'invoice', 'update')) {
					return undefined;
				}

				const statusTransitions = getStatusTransitions(
					entry.status,
					STATUS_TRANSITIONS,
				);

				if (statusTransitions.length === 0) {
					return undefined;
				}

				return entry.status === InvoiceStatusEnum.DRAFT
					? 'issue'
					: 'cancel';
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
					order_id: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					payment_status: { value: null, matchMode: 'equals' },
					type: { value: null, matchMode: 'equals' },
					currency: { value: null, matchMode: 'equals' },
					is_overdue: { value: null, matchMode: 'equals' },
					issued_at_start: { value: null, matchMode: 'equals' },
					issued_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies InvoiceDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'invoice',
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'ref_number',
					header: 'Reference',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// A draft holds no number - the series only hands one out on issue
							customValue: entry.ref_number
								? `${entry.ref_code}-${entry.ref_number}`
								: '-',
						}),
				},
				{
					field: 'type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.type),
						}),
				},
				{
					field: 'order_id',
					header: 'Order',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							// The joined order, falling back to the id when the listing was
							// served without it
							customValue: entry.order
								? displayOrderReference(entry.order)
								: `#${entry.order_id}`,
							displayButton: displayButtonViewOrder(auth, entry),
						}),
				},
				{
					field: 'total_gross',
					header: 'Total',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayAmount({
								amount: entry.total_gross,
								currencyCode: entry.currency,
							}),
						}),
				},
				{
					field: 'payment_status',
					header: 'Payment',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							dataSource: 'invoice',
							isStatus: true,
						}),
					minWidth: 140,
					maxWidth: 140,
				},
				{
					field: 'status',
					header: 'Status',
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'invoice',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 160,
					maxWidth: 160,
				},
				{
					field: 'issued_at',
					header: 'Issued At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
				{
					field: 'due_at',
					header: 'Due At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<InvoiceModel>('invoice', params),
		},
		displayEntryLabel: (entry: InvoiceModel) => displayInvoiceLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormCreateInvoice,
				permission: ['invoice', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: InvoiceCreateOutput) =>
					requestCreate<InvoiceModel, InvoiceCreateOutput>(
						'invoice',
						values,
					),
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getCreateFormValues,
				validateForm: validateCreateForm,
				getFormState: getCreateFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormUpdateInvoice,
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: InvoiceModel) =>
					arrayHasValue(entry.status, MUTABLE_STATUSES) &&
					!entry.deleted_at,
				operationFunction: (values: InvoiceUpdateOutput, id: number) =>
					requestUpdate<InvoiceModel, InvoiceUpdateOutput>(
						'invoice',
						values,
						id,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getUpdateFormValues,
				validateForm: validateUpdateForm,
				getFormState: getUpdateFormState,
			},
			issue: {
				windowType: 'action',
				windowTitle: translations['issue.title'],
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					entry.status === InvoiceStatusEnum.DRAFT,
				operationFunction: (entry: InvoiceModel) =>
					requestUpdateStatus(
						'invoice',
						entry,
						InvoiceStatusEnum.ISSUED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
			},
			cancel: {
				windowType: 'action',
				windowTitle: translations['cancel.title'],
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: InvoiceModel) => {
					const statusTransitions = getStatusTransitions(
						entry.status,
						STATUS_TRANSITIONS,
					);

					return (
						!entry.deleted_at &&
						arrayHasValue(
							InvoiceStatusEnum.CANCELLED,
							statusTransitions,
						)
					);
				},
				operationFunction: (entry: InvoiceModel) =>
					requestUpdateStatus(
						'invoice',
						entry,
						InvoiceStatusEnum.CANCELLED,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			allocatePayment: {
				windowType: 'form',
				windowTitle: translations['allocatePayment.title'],
				windowComponent: FormAllocatePaymentInvoice,
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				// A draft has no number and nothing to settle against
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					entry.status === InvoiceStatusEnum.ISSUED,
				operationFunction: (
					values: InvoiceAllocatePaymentOutput,
					id: number,
				) =>
					requestInvoicePaymentCreate(id, {
						...values,
						// `validateId` resolves to `number | null` here; the schema has
						// already established it is present
						cash_flow_id: Number(values.cash_flow_id),
					}),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getAllocatePaymentFormValues,
				validateForm: validateAllocatePaymentForm,
				getFormState: getAllocatePaymentFormState,
			},
			creditNote: {
				windowType: 'action',
				windowTitle: translations['creditNote.title'],
				permission: ['invoice', 'create'],
				entriesSelection: 'single',
				// Only an issued charge can be credited - a credit note cannot be credited
				// in turn
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					entry.status === InvoiceStatusEnum.ISSUED &&
					entry.type === InvoiceTypeEnum.CHARGE,
				operationFunction: async (entry: InvoiceModel) => {
					const response = await requestInvoiceCreditNote(entry.id);

					/*
					 * The window reports the outcome and reloads the list; the created note
					 * is not rendered here, so its payload is dropped rather than widening
					 * what an action window is allowed to answer with.
					 */
					return response
						? { ...response, data: undefined }
						: undefined;
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['invoice', 'delete'],
				entriesSelection: 'single',
				// An issued document is the record of what was charged; it leaves service
				// through `canceled` rather than being removed
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					entry.status === InvoiceStatusEnum.DRAFT,
				operationFunction: (entry: InvoiceModel) =>
					requestDelete('invoice', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			manage: {
				windowType: 'other',
				windowTitle: translations['manage.title'],
				windowComponent: ManageInvoice,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				// Drafts only: an issued document is the record of what was charged, so there
				// is nothing here to add, restate or drop
				customEntryCheck: (entry: InvoiceModel) =>
					arrayHasValue(entry.status, MUTABLE_STATUSES) &&
					!entry.deleted_at,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewInvoice,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['invoice', 'read'],
				entriesSelection: 'single',
				/*
				 * The list projection carries no `lines` and no `payments` - only `read` joins
				 * them - so the row the data table hands over would render a document that
				 * itemizes nothing.
				 */
				reloadEntry: (id: number) =>
					requestView<InvoiceModel>('invoice', id),
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideInvoice,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['invoice', 'read'],
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

async function validateCreateForm(values: InvoiceCreateFormValuesType) {
	return (await buildValidator()).create.safeParse(values);
}

function getCreateFormValues(formData: FormData): InvoiceCreateFormValuesType {
	return {
		order_id: getFormDataAsNumber(formData, 'order_id'),
		due_at: getFormDataAsString(formData, 'due_at'),
		notes: getFormDataAsString(formData, 'notes'),
		// display-only, not submitted to the validator
		order: getFormDataAsString(formData, 'order'),
	};
}

function getCreateFormState(): FormStateType<InvoiceCreateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			order_id: null,
			// Left empty on purpose: the API stamps the configured payment term from the day
			// the document is issued, which is not knowable while it is still a draft
			due_at: null,
			notes: null,
			order: null,
		},
	};
}

async function validateUpdateForm(values: InvoiceUpdateFormValuesType) {
	return (await buildValidator()).update.safeParse(values);
}

function getUpdateFormValues(formData: FormData): InvoiceUpdateFormValuesType {
	return {
		due_at: getFormDataAsString(formData, 'due_at'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getUpdateFormState(
	data?: InvoiceModel,
): FormStateType<InvoiceUpdateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			// The calendar field reads `YYYY-MM-DD` and nothing else - `parseDate` throws on a
			// full ISO timestamp, which is what the document carries
			due_at: toCalendarValue(data?.due_at ?? null),
			notes: data?.notes ?? null,
		},
	};
}

async function validateAllocatePaymentForm(
	values: InvoiceAllocatePaymentFormValuesType,
) {
	return (await buildValidator()).allocatePayment.safeParse(values);
}

function getAllocatePaymentFormValues(
	formData: FormData,
): InvoiceAllocatePaymentFormValuesType {
	return {
		cash_flow_id: getFormDataAsNumber(formData, 'cash_flow_id'),
		amount: getFormDataAsNumber(formData, 'amount'),
		notes: getFormDataAsString(formData, 'notes'),
		// display-only, not submitted to the validator
		cash_flow: getFormDataAsString(formData, 'cash_flow'),
	};
}

function getAllocatePaymentFormState(
	data?: InvoiceModel,
): FormStateType<InvoiceAllocatePaymentFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			cash_flow_id: null,
			// What is still owed, which is what a single transfer usually settles
			amount: data ? data.total_gross : null,
			notes: null,
			cash_flow: null,
		},
	};
}
