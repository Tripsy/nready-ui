import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	emptyOrderLine,
	FormManageOrder,
	nextOrderLineKey,
	type OrderFormValuesType,
} from '@/app/(dashboard)/dashboard/order/form-manage-order.component';
import { StatusTransitionOrder } from '@/app/(dashboard)/dashboard/order/status-transition-order.component';
import { UsageGuideOrder } from '@/app/(dashboard)/dashboard/order/usage-guide-order.component';
import { ViewOrder } from '@/app/(dashboard)/dashboard/order/view-order.component';
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
import {
	displayOrderClient,
	displayOrderLabel,
	displayOrderReference,
	ORDER_LINES_MAX,
	ORDER_STATUS_TRANSITIONS,
	type OrderModel,
	type OrderStatus,
	OrderStatusEnum,
	type OrderType,
	OrderTypeEnum,
} from '@/models/order.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	'invalid_client_id',
	'invalid_currency',
	'invalid_type',
	'invalid_issued_at',
	'invalid_lines',
	'invalid_variant_id',
	'invalid_product_id',
	'invalid_quantity',
	'invalid_price',
	'invalid_vat_rate',
	'invalid_options',
	'invalid_notes',
] as const;

/** Mirrors the backend's `order.validator.ts` - see `../nready-api/src/features/order`. */
class OrderValidator extends BaseValidator<typeof validatorMessages> {
	/**
	 * `product_id` has no field of its own: it is set from the variant the operator picked, and the
	 * two travel together because the backend row holds both under one composite key. A row with a
	 * variant has a product by construction, so a failure here says the form wrote the pair
	 * inconsistently rather than that anybody mistyped anything - which is why it reports under its
	 * own message rather than pointing at the variant picker.
	 */
	private line = () =>
		z.object({
			variant_id: this.validateId(this.getMessage('invalid_variant_id')),
			product_id: this.validateId(this.getMessage('invalid_product_id')),
			quantity: this.validateNumber(this.getMessage('invalid_quantity'), {
				required: true,
				onlyPositive: true,
				allowDecimals: 2,
			}),
			/*
			 * Zero is legal, and not an oversight: a bundle header line carries no money of its
			 * own while the component lines beneath it carry all of it.
			 */
			price: this.validateNumber(this.getMessage('invalid_price'), {
				required: true,
				onlyPositive: false,
				allowDecimals: 2,
			}).refine((value) => value >= 0, {
				message: this.getMessage('invalid_price'),
			}),
			vat_rate: this.validateNumber(this.getMessage('invalid_vat_rate'), {
				required: true,
				onlyPositive: false,
				allowDecimals: 2,
			}).refine((value) => value >= 0 && value <= 100, {
				message: this.getMessage('invalid_vat_rate'),
			}),
			/** `product_option` ids; the backend checks they belong to the product and fit its questions. */
			options: z.array(z.number(), {
				message: this.getMessage('invalid_options'),
			}),
			notes: this.validateString(this.getMessage('invalid_notes'), {
				required: false,
			}),
			key: z.string(),
		});

	manage = () =>
		z.object({
			client_id: this.validateId(this.getMessage('invalid_client_id')),
			currency: this.validateString(this.getMessage('invalid_currency'), {
				minChars: 3,
				maxChars: 3,
			}),
			type: z.enum(Object.values(OrderTypeEnum), {
				message: this.getMessage('invalid_type'),
			}),
			issued_at: z.string().nullable(),
			notes: this.validateString(this.getMessage('invalid_notes'), {
				required: false,
			}),
			/*
			 * Validated, though it is never sent: the submit has to know whether the document is
			 * still pending to decide whether the lines go with it, and `operationFunction` is
			 * handed the validated output rather than the raw form values. It is stripped in
			 * `prepareParamsFromFormValues` with the other display-only fields.
			 */
			status: z.enum(Object.values(OrderStatusEnum)).nullable(),
			lines: z
				.array(this.line())
				.min(1, this.getMessage('invalid_lines'))
				.max(ORDER_LINES_MAX, this.getMessage('invalid_lines')),
		});
}

async function validateForm(values: OrderFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'order.validation',
	);

	const validator = new OrderValidator(translations);

	return validator.manage().safeParse(values);
}

type OrderManageOutput = ValidatorOutput<OrderValidator, 'manage'>;

/**
 * `client` and the per-line `label` are the autocompletes' visible text and are never sent on;
 * `status` is carried only so the form can decide whether the lines are editable.
 *
 * **The lines are dropped for anything but a pending order.** The backend refuses a line set on a
 * confirmed order with a 409, and the form does not offer the editor there - so sending the set back
 * unchanged would be asking for a refusal on work nobody did.
 *
 * **The currency travels with them, and only with them.** No order row holds one: each line
 * carries its own, so the backend refuses a currency that arrives without a line set to stamp it
 * onto - which makes it exactly as editable as the lines are.
 */
function prepareParamsFromFormValues(
	data: OrderManageOutput,
	status: OrderStatus | null,
) {
	const isEditable = status === null || status === OrderStatusEnum.PENDING;

	return {
		client_id: data.client_id,
		type: data.type,
		issued_at: data.issued_at,
		notes: data.notes,
		...(isEditable
			? {
					currency: data.currency,
					lines: data.lines.map((line) => ({
						variant_id: line.variant_id,
						product_id: line.product_id,
						quantity: line.quantity,
						price: line.price,
						vat_rate: line.vat_rate,
						options: line.options,
						notes: line.notes,
					})),
				}
			: {}),
	};
}

function getFormValues(formData: FormData): OrderFormValuesType {
	return {
		client_id: getFormDataAsNumber(formData, 'client_id'),
		client: getFormDataAsString(formData, 'client_label'),
		currency: getFormDataAsString(formData, 'currency'),
		type: getFormDataAsString(formData, 'type'),
		issued_at: getFormDataAsString(formData, 'issued_at'),
		notes: getFormDataAsString(formData, 'notes'),
		/*
		 * Defaulted rather than trusted: the list is parsed back from the hidden JSON field the
		 * form wrote, and a restored window draft can predate the key entirely. The validator
		 * requires it, so an absent one would fail the submit on a field nobody can see.
		 */
		lines: getFormDataAsJsonList<OrderFormValuesType['lines'][number]>(
			formData,
			'lines',
		),
		status: getFormDataAsString(formData, 'status') as OrderStatus | null,
	};
}

function getFormState(data?: OrderModel): FormStateType<OrderFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			client_id: data?.client_id ?? null,
			client: data ? displayOrderClient(data) : null,
			currency: data?.totals?.currency ?? null,
			type: data?.type ?? OrderTypeEnum.STANDARD,
			// The calendar field reads `YYYY-MM-DD` and nothing else - `parseDate` throws on a
			// full ISO timestamp, which is what the document carries
			issued_at: toCalendarValue(data?.issued_at ?? null),
			notes: data?.notes ?? null,
			/*
			 * A create opens with one empty line, since an order with none cannot be saved. An
			 * update starts from the stored set, which the window re-reads to get - the listing
			 * row carries no lines at all.
			 */
			lines: data
				? (data.lines ?? []).map((line) => ({
						variant_id: line.variant_id,
						product_id: line.product_id,
						quantity: line.quantity,
						price: line.price,
						vat_rate: line.vat_rate,
						/*
						 * The ids read back off the stored snapshots, so saving the line keeps what was
						 * chosen. A snapshot written before ids were recorded has none to give, and its
						 * option is dropped on the next save of the line set.
						 */
						options: (line.options ?? []).flatMap((option) =>
							option.option_id ? [option.option_id] : [],
						),
						notes: line.notes,
						label: line.variant?.sku ?? `#${line.variant_id}`,
						discount_reduction: line.discount_reduction,
						discount_label:
							line.discount && line.discount.length > 0
								? line.discount
										.map((entry) => entry.label)
										.join(', ')
								: null,
						key: nextOrderLineKey(),
					}))
				: [emptyOrderLine()],
			status: data?.status ?? null,
		},
	};
}

export type OrderDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: OrderStatus | null; matchMode: 'equals' };
	type: { value: OrderType | null; matchMode: 'equals' };
	issued_at_start: { value: string | null; matchMode: 'equals' };
	issued_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };

	client: { value: string | null; matchMode: 'equals' };
	client_id: { value: number | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<OrderModel>
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
		'order.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<OrderModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'order', 'read') ? 'view' : undefined,
			dataSource: 'order',
		};
	}

	/**
	 * The status badge opens the transition window rather than performing a move.
	 *
	 * An order has two ways out of most of its states - a pending one can be confirmed or
	 * canceled, a confirmed one completed or canceled - so the badge cannot pick one; it offers the choice. A
	 * deleted row is the exception: what it needs is to come back, not to move on.
	 */
	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<OrderModel>['displayButton'] {
		return {
			action: (entry: OrderModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'order', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'order', 'update')) {
					return undefined;
				}

				return getStatusTransitions(
					entry.status,
					ORDER_STATUS_TRANSITIONS,
				).length > 0
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
				sortField: 'issued_at',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					status: { value: null, matchMode: 'equals' },
					type: { value: null, matchMode: 'equals' },
					issued_at_start: { value: null, matchMode: 'equals' },
					issued_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
					client: { value: null, matchMode: 'equals' },
					client_id: { value: null, matchMode: 'equals' },
				} satisfies OrderDataTableFiltersType,
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
					field: 'ref_number',
					header: 'Reference',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayOrderReference(entry),
						}),
				},
				{
					field: 'client_id',
					header: 'Client',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayOrderClient(entry),
						}),
				},
				{
					field: 'type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.type),
						}),
					minWidth: 120,
					maxWidth: 140,
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'order',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
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
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<OrderModel>('order', params),
		},
		displayEntryLabel: (entry: OrderModel) => displayOrderLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageOrder,
				windowConfigProps: {
					size: 'xl3',
				},
				permission: ['order', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: OrderManageOutput) => {
					const params = prepareParamsFromFormValues(values, null);

					return requestCreate<OrderModel, typeof params>(
						'order',
						params,
					);
				},
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
				windowComponent: FormManageOrder,
				windowConfigProps: {
					size: 'xl3',
				},
				permission: ['order', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderModel) => !entry.deleted_at,
				/*
				 * Re-read, and not as an optimization: the listing row carries no lines, so a
				 * form built from it would open a pending order with an empty editor and replace the
				 * document's lines with whatever was typed into it.
				 */
				reloadEntry: (id: number) =>
					requestView<OrderModel>('order', id),
				operationFunction: (values: OrderManageOutput, id: number) => {
					const params = prepareParamsFromFormValues(
						values,
						values.status ?? null,
					);

					return requestUpdate<OrderModel, typeof params>(
						'order',
						params,
						id,
					);
				},
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
				permission: ['order', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderModel) => !entry.deleted_at,
				operationFunction: (entry: OrderModel) =>
					requestDelete('order', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['order', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderModel) => !!entry.deleted_at,
				operationFunction: (entry: OrderModel) =>
					requestRestore('order', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionOrder,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['order', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: OrderModel) =>
					!entry.deleted_at &&
					getStatusTransitions(entry.status, ORDER_STATUS_TRANSITIONS)
						.length > 0,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewOrder,
				windowConfigProps: {
					size: 'xl3',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['order', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				// The row the table holds carries neither lines nor totals - the read is what
				// resolves both
				reloadEntry: (id: number) =>
					requestView<OrderModel>('order', id),
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideOrder,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['order', 'read'],
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
