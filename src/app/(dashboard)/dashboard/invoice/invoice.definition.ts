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
	FormReverseInvoice,
	type InvoiceReverseFormValuesType,
	type ReverseLineFormType,
	ReverseLineModeEnum,
} from '@/app/(dashboard)/dashboard/invoice/form-reverse-invoice.component';
import { ManageInvoice } from '@/app/(dashboard)/dashboard/invoice/manage-invoice.component';
import { StatusTransitionInvoice } from '@/app/(dashboard)/dashboard/invoice/status-transition-invoice.component';
import { UsageGuideInvoice } from '@/app/(dashboard)/dashboard/invoice/usage-guide-invoice.component';
import { ViewInvoice } from '@/app/(dashboard)/dashboard/invoice/view-invoice.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { DisplayAmount } from '@/helpers/display.helper';
import {
	getFormDataAsJsonList,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import { requestFind, requestView } from '@/helpers/services.helper';
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
	InvoicePaymentStatusEnum,
	type InvoiceScope,
	type InvoiceStatus,
	InvoiceStatusEnum,
	MUTABLE_STATUSES,
	STATUS_TRANSITIONS,
} from '@/models/invoice.model';
import { displayOrderReference } from '@/models/order.model';
import {
	requestInvoiceCustomCreate,
	requestInvoicePaymentClear,
	requestInvoicePaymentCreate,
	requestInvoiceReverse,
} from '@/services/invoice.service';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Currency } from '@/types/common.type';
import {
	type DataSourceConfigType,
	DataSourceSectionEnum,
	type DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_client_id',
	'invalid_notes',
	'invalid_cash_flow_id',
	'invalid_amount',
	'invalid_reverse_lines',
] as const;

class InvoiceValidator extends BaseValidator<typeof validatorMessages> {
	private notes() {
		return this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		});
	}

	/**
	 * A custom document - the one raised by hand; orders, deliveries and subscriptions are
	 * invoiced as they happen. Only the client is asked for: the rest is written in the update
	 * window the draft opens in, the same one every draft is edited in.
	 */
	create = z.object({
		client_id: this.validateId(this.getMessage('invalid_client_id')),
	});

	/**
	 * At least one line with a figure, each within what earlier reversals left - the API enforces
	 * the same caps; checking here keeps the operator in the form instead of a 409. A line left
	 * empty or at zero is simply not reversed.
	 */
	reverse = z.object({
		lines: z.array(z.custom<ReverseLineFormType>()).refine(
			(lines) => {
				const picked = lines.filter(isReversedLine);

				return (
					picked.length > 0 &&
					picked.every((line) =>
						line.mode === ReverseLineModeEnum.QUANTITY
							? Number(line.quantity) <= line.max_quantity
							: Number(line.amount) <= line.max_net,
					)
				);
			},
			{ message: this.getMessage('invalid_reverse_lines') },
		),
		notes: this.notes(),
		currency: z.string().nullable(),
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
type InvoiceReverseOutput = ValidatorOutput<InvoiceValidator, 'reverse'>;
type InvoiceAllocatePaymentOutput = ValidatorOutput<
	InvoiceValidator,
	'allocatePayment'
>;

export type InvoiceDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	order_id: { value: number | null; matchMode: 'equals' };
	status: { value: InvoiceStatus | null; matchMode: 'equals' };
	payment_status: { value: InvoicePaymentStatus | null; matchMode: 'equals' };
	scope: { value: InvoiceScope | null; matchMode: 'equals' };
	is_reversal: { value: boolean | null; matchMode: 'equals' };
	currency: { value: Currency | null; matchMode: 'equals' };
	is_overdue: { value: boolean | null; matchMode: 'equals' };
	issued_at_start: { value: string | null; matchMode: 'equals' };
	issued_at_end: { value: string | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<InvoiceModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'manage.title',
			'view.title',
			'viewOrder.title',
			'statusTransition.title',
			'reverse.title',
			'allocatePayment.title',
			'clearPayments.title',
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
	 * The status badge opens the transition window rather than performing a move: a draft can be
	 * issued or canceled, so the badge cannot pick one. `STATUS_TRANSITIONS` decides, so a status
	 * with nothing left (`canceled`) shows no button at all.
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

				return getStatusTransitions(entry.status, STATUS_TRANSITIONS)
					.length > 0
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
					order_id: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					payment_status: { value: null, matchMode: 'equals' },
					scope: { value: null, matchMode: 'equals' },
					is_reversal: { value: null, matchMode: 'equals' },
					currency: { value: null, matchMode: 'equals' },
					is_overdue: { value: null, matchMode: 'equals' },
					issued_at_start: { value: null, matchMode: 'equals' },
					issued_at_end: { value: null, matchMode: 'equals' },
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
					field: 'scope',
					header: 'Scope',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							// A reversal reads as the scope it reverses, marked as a storno
							customValue: entry.is_reversal
								? `${formatEnumLabel(entry.scope)} (storno)`
								: formatEnumLabel(entry.scope),
						}),
				},
				{
					field: 'order_id',
					header: 'Order',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							// The joined order, falling back to the id when the listing was
							// served without it. No order at all on a document raised from a bare cash flow entry
							customValue: entry.order
								? displayOrderReference(entry.order)
								: entry.order_id
									? `#${entry.order_id}`
									: '-',
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
					field: 'amount_outstanding',
					header: 'Outstanding',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue:
								entry.amount_outstanding == null
									? undefined
									: DisplayAmount({
											amount: entry.amount_outstanding,
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
					requestInvoiceCustomCreate({
						// `validateId` resolves to `number | null` here; the schema has already
						// established it is present
						client_id: Number(values.client_id),
					}),
				events: {
					// The draft is empty: straight into the window its lines and parties are
					// written in
					success: (entry?: InvoiceModel) => {
						if (!entry?.id) {
							return;
						}

						useModalStore.getState().open({
							minimized: false,
							section: DataSourceSectionEnum.DASHBOARD,
							dataSource: 'invoice',
							action: 'manage',
							data: { entries: [entry] },
						});
					},
				},
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getCreateFormValues,
				validateForm: validateCreateForm,
				getFormState: getCreateFormState,
			},
			manage: {
				windowType: 'other',
				windowTitle: translations['manage.title'],
				windowComponent: ManageInvoice,
				windowConfigProps: {
					size: 'xl4',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				// Drafts only: an issued document is the record of what was charged, so there
				// is nothing here to restate, add or drop
				customEntryCheck: (entry: InvoiceModel) =>
					arrayHasValue(entry.status, MUTABLE_STATUSES) &&
					!entry.deleted_at,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
					// The key is `manage` only because `update` is reserved for a form window; to
					// the operator it is the update action, so it wears that icon
					icon: Icons.Action.Update,
				},
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionInvoice,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					getStatusTransitions(entry.status, STATUS_TRANSITIONS)
						.length > 0,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			allocatePayment: {
				windowType: 'form',
				windowTitle: translations['allocatePayment.title'],
				windowComponent: FormAllocatePaymentInvoice,
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				// A draft has no number and nothing to settle against; a paid document has nothing
				// left outstanding, so the API refuses any amount
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					entry.status === InvoiceStatusEnum.ISSUED &&
					entry.payment_status !== InvoicePaymentStatusEnum.PAID,
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
			clearPayments: {
				windowType: 'action',
				windowTitle: translations['clearPayments.title'],
				permission: ['invoice', 'update'],
				entriesSelection: 'single',
				/*
				 * Only an original with money on it. A reversal's payments are refunds already paid
				 * out, and the API also refuses an original with an issued reversal - which the row
				 * does not carry, so that refusal comes back as the API's message.
				 */
				customEntryCheck: (entry: InvoiceModel) =>
					entry.status === InvoiceStatusEnum.ISSUED &&
					!entry.is_reversal &&
					entry.payment_status !== InvoicePaymentStatusEnum.UNPAID,
				operationFunction: (entry: InvoiceModel) =>
					requestInvoicePaymentClear(entry.id),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			reverse: {
				windowType: 'form',
				windowTitle: translations['reverse.title'],
				windowComponent: FormReverseInvoice,
				windowConfigProps: {
					size: 'xl3',
				},
				permission: ['invoice', 'create'],
				entriesSelection: 'single',
				// Only an issued original with something left to take back - a reversal cannot be
				// reversed in turn, and one reversed in full has nothing left. A row without the
				// figure (not from a listing) is not refused here; the API refuses an empty reversal
				customEntryCheck: (entry: InvoiceModel) =>
					!entry.deleted_at &&
					entry.status === InvoiceStatusEnum.ISSUED &&
					!entry.is_reversal &&
					(entry.reversible_net === undefined ||
						(entry.reversible_net ?? 0) > 0),
				/*
				 * Re-read: the listing row carries no lines, and the read is what reports how
				 * much of each line earlier reversals already took back.
				 */
				reloadEntry: (id: number) =>
					requestView<InvoiceModel>('invoice', id),
				operationFunction: (values: InvoiceReverseOutput, id: number) =>
					requestInvoiceReverse(id, {
						notes: values.notes,
						lines: values.lines
							.filter(isReversedLine)
							.map((line) =>
								line.mode === ReverseLineModeEnum.QUANTITY
									? {
											invoice_line_id:
												line.invoice_line_id,
											quantity: Number(line.quantity),
										}
									: {
											invoice_line_id:
												line.invoice_line_id,
											amount: Number(line.amount),
										},
							),
					}),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
				getFormValues: getReverseFormValues,
				validateForm: validateReverseForm,
				getFormState: getReverseFormState,
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
		client_id: getFormDataAsNumber(formData, 'client_id'),
		// display-only, not submitted to the validator
		client: getFormDataAsString(formData, 'client'),
	};
}

function getCreateFormState(): FormStateType<InvoiceCreateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			client_id: null,
			client: null,
		},
	};
}

/** A line the operator is taking back: the figure for its chosen mode is above zero. */
function isReversedLine(line: ReverseLineFormType): boolean {
	const figure =
		line.mode === ReverseLineModeEnum.QUANTITY
			? line.quantity
			: line.amount;

	return figure !== null && figure > 0;
}

/** Two decimals, the precision every invoice figure is stored at. */
function toCents(value: number): number {
	return Math.round(value * 100) / 100;
}

async function validateReverseForm(values: InvoiceReverseFormValuesType) {
	return (await buildValidator()).reverse.safeParse(values);
}

function getReverseFormValues(
	formData: FormData,
): InvoiceReverseFormValuesType {
	return {
		lines: getFormDataAsJsonList<ReverseLineFormType>(formData, 'lines'),
		notes: getFormDataAsString(formData, 'notes'),
		currency: getFormDataAsString(formData, 'currency'),
	};
}

function getReverseFormState(
	data?: InvoiceModel,
): FormStateType<InvoiceReverseFormValuesType> {
	const lines = (data?.lines ?? [])
		.map((line): ReverseLineFormType => {
			const maxQuantity = toCents(
				line.quantity - (line.reversed_quantity ?? 0),
			);
			const maxNet = toCents(line.line_net - (line.reversed_net ?? 0));

			// The units left priced as the line priced them, discount shared out
			const quantityNet =
				line.quantity > 0
					? toCents(
							line.unit_price * maxQuantity -
								(line.discount_reduction * maxQuantity) /
									line.quantity,
						)
					: 0;

			const quantityFits =
				maxQuantity > 0 && quantityNet <= maxNet + 0.005;

			return {
				invoice_line_id: line.id,
				label: line.label,
				mode: ReverseLineModeEnum.QUANTITY,
				quantity: quantityFits ? maxQuantity : null,
				amount: null,
				max_quantity: Math.max(maxQuantity, 0),
				max_net: Math.max(maxNet, 0),
				unit_price: line.unit_price,
			};
		})
		.filter((line) => line.max_net > 0);

	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			lines: lines,
			notes: null,
			currency: data?.currency ?? null,
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
			amount: data ? (data.amount_outstanding ?? data.total_gross) : null,
			notes: null,
			cash_flow: null,
		},
	};
}
