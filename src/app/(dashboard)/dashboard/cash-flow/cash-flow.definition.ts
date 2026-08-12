import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type CashFlowFormValuesType,
	FormManageCashFlow,
} from '@/app/(dashboard)/dashboard/cash-flow/form-manage-cash-flow.component';
import { ViewCashFlow } from '@/app/(dashboard)/dashboard/cash-flow/view-cash-flow.component';
import { Configuration } from '@/config/settings.config';
import { translateBatch } from '@/config/translate.setup';
import { DisplayAmount, formatAmount } from '@/helpers/display.helper';
import {
	getFormDataAsEnum,
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
} from '@/helpers/services.helper';
import { formatEnumLabel, replaceVars } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type CashFlowCategory,
	CashFlowCategoryEnum,
	type CashFlowDirection,
	type CashFlowMethod,
	CashFlowMethodEnum,
	type CashFlowModel,
	type CashFlowStatus,
	CashFlowStatusEnum,
	getExpectedCategoryType,
	getExpectedDirection,
	getOperationalRecordOptions,
	MUTABLE_STATUSES,
	type OperationalRecordType,
	OperationalRecordTypeEnum,
	REFUNDABLE_STATUSES,
	STATUS_TRANSITIONS,
} from '@/models/cash-flow.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import { type Currency, CurrencyEnum } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_category',
	'invalid_method',
	'invalid_amount',
	'invalid_vat_rate',
	'invalid_currency',
	'invalid_external_reference',
	'invalid_parent_id',
	'invalid_notes',
	'invalid_client',
	'invalid_vendor',
	'invalid_employee',
	'invalid_company_vehicle',
	'invalid_cmr',
	'required_operational_record_type',
] as const;

class CashFlowValidator extends BaseValidator<typeof validatorMessages> {
	readonly operationalRecords = z
		.object({
			[OperationalRecordTypeEnum.CLIENT]: this.validateId(
				this.getMessage('invalid_client'),
				{ required: false },
			),
			[OperationalRecordTypeEnum.VENDOR]: this.validateId(
				this.getMessage('invalid_vendor'),
				{ required: false },
			),
			[OperationalRecordTypeEnum.EMPLOYEE]: this.validateId(
				this.getMessage('invalid_employee'),
				{ required: false },
			),
			[OperationalRecordTypeEnum.COMPANY_VEHICLE]: this.validateId(
				this.getMessage('invalid_company_vehicle'),
				{ required: false },
			),
			[OperationalRecordTypeEnum.CMR]: this.validateId(
				this.getMessage('invalid_cmr'),
				{ required: false },
			),
		})
		.optional();

	manage = z
		.object({
			category: this.validateEnum(
				CashFlowCategoryEnum,
				this.getMessage('invalid_category'),
			),
			method: this.validateEnum(
				CashFlowMethodEnum,
				this.getMessage('invalid_method'),
			),
			amount: this.validateNumber(this.getMessage('invalid_amount'), {
				required: true,
				onlyPositive: false,
				allowDecimals: 2,
			}),
			vat_rate: this.validateNumber(
				{
					invalid: this.getMessage('invalid_vat_rate'),
					only_positive: this.getMessage('only_positive'),
				},
				{
					required: true,
					onlyPositive: true,
					allowDecimals: 2,
				},
			),
			currency: this.validateEnum(
				CurrencyEnum,
				this.getMessage('invalid_currency'),
			),
			external_reference: this.validateString(
				this.getMessage('invalid_external_reference'),
				{ required: false },
			),
			parent_id: this.validateId(this.getMessage('invalid_parent_id'), {
				required: false,
			}),
			notes: this.validateString(this.getMessage('invalid_notes'), {
				required: false,
			}),
			operational_records: this.operationalRecords,
		})
		.superRefine((data, ctx) => {
			const requiredOptions = getOperationalRecordOptions(
				data.category,
				'required',
			);

			if (!requiredOptions) {
				return; // Category has no operational record required options
			}

			for (const [type] of Object.entries(requiredOptions)) {
				if (
					!data.operational_records?.[type as OperationalRecordType]
				) {
					ctx.addIssue({
						path: ['operational_records', type],
						message: replaceVars(
							this.getMessage('required_operational_record_type'),
							{ type },
						),
						code: 'custom',
					});
				}
			}
		});
}

async function validateForm(values: CashFlowFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'cash-flow',
	);

	const validator = new CashFlowValidator(translations);

	return validator.manage.safeParse(values);
}

function getFormValues(formData: FormData): CashFlowFormValuesType {
	return {
		category:
			getFormDataAsEnum(formData, 'category', CashFlowCategoryEnum) ||
			CashFlowCategoryEnum.CUSTOMER,
		method:
			getFormDataAsEnum(formData, 'method', CashFlowMethodEnum) ||
			CashFlowMethodEnum.CASH,
		amount: getFormDataAsNumber(formData, 'amount'),
		vat_rate: getFormDataAsNumber(formData, 'vat_rate') || 0,
		currency:
			getFormDataAsEnum(formData, 'currency', CurrencyEnum) ||
			Configuration.currency(),
		external_reference: getFormDataAsString(formData, 'external_reference'),
		parent_id: getFormDataAsNumber(formData, 'parent_id'),
		notes: getFormDataAsString(formData, 'notes'),
		// Operational records
		operational_records: {
			[OperationalRecordTypeEnum.CLIENT]: getFormDataAsNumber(
				formData,
				'operational_records.client',
			),
			[OperationalRecordTypeEnum.EMPLOYEE]: getFormDataAsNumber(
				formData,
				'operational_records.employee',
			),
			[OperationalRecordTypeEnum.VENDOR]: getFormDataAsNumber(
				formData,
				'operational_records.vendor',
			),
			[OperationalRecordTypeEnum.COMPANY_VEHICLE]: getFormDataAsNumber(
				formData,
				'operational_records.company_vehicle',
			),
			[OperationalRecordTypeEnum.CMR]: getFormDataAsNumber(
				formData,
				'operational_records.cmr',
			),
		},
		// display-only, not submitted to validator
		client: getFormDataAsString(formData, 'client'),
		employee: getFormDataAsString(formData, 'employee'),
		company_vehicle: getFormDataAsString(formData, 'company_vehicle'),
		vendor: getFormDataAsString(formData, 'vendor'),
		cmr: getFormDataAsString(formData, 'cmr'),
	};
}

function getFormState(
	data?: CashFlowModel,
): FormStateType<CashFlowFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			category: data?.category ?? CashFlowCategoryEnum.CUSTOMER,
			method: data?.method ?? CashFlowMethodEnum.CASH,
			amount: data?.amount ?? null,
			vat_rate: data?.vat_rate ?? Configuration.get('app.vatRate'),
			currency: data?.currency ?? Configuration.currency(),
			external_reference: data?.external_reference ?? null,
			parent_id: data?.parent_id ?? null,
			notes: data?.notes ?? null,

			// Operational records - Data is selected via form component
			operational_records: undefined,
			client: null,
			employee: null,
			company_vehicle: null,
			vendor: null,
			cmr: null,
		},
	};
}

type CashFlowManageOutput = ValidatorOutput<CashFlowValidator, 'manage'>;

function prepareParamsFromFormValues(data: CashFlowManageOutput) {
	const category_type = getExpectedCategoryType(data.category);
	const direction = getExpectedDirection(category_type, Number(data.amount));

	return {
		...data,
		direction,
		category_type,
	};
}

export type CashFlowDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	direction: { value: CashFlowDirection | null; matchMode: 'equals' };
	category: { value: CashFlowCategory | null; matchMode: 'equals' };
	method: { value: CashFlowMethod | null; matchMode: 'equals' };
	currency: { value: Currency | null; matchMode: 'equals' };
	status: { value: CashFlowStatus | null; matchMode: 'equals' };
	create_at_start: { value: string | null; matchMode: 'equals' };
	create_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };

	client: { value: string | null; matchMode: 'equals' };
	client_id: { value: number | null; matchMode: 'equals' };
	employee: { value: string | null; matchMode: 'equals' };
	employee_id: { value: number | null; matchMode: 'equals' };
	vendor: { value: string | null; matchMode: 'equals' };
	vendor_id: { value: number | null; matchMode: 'equals' };
	company_vehicle: { value: string | null; matchMode: 'equals' };
	company_vehicle_id: { value: number | null; matchMode: 'equals' };
	cmr: { value: string | null; matchMode: 'equals' };
	cmr_id: { value: number | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CashFlowModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'refund.title',
			'update.title',
			'view.title',
			'delete.title',
			'complete.title',
			'cancel.title',
		] as const,
		'cash-flow.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<CashFlowModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'cash-flow', 'read') ? 'view' : undefined,
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<CashFlowModel>['displayButton'] {
		return {
			action: (entry: CashFlowModel) => {
				if (entry.deleted_at) {
					return undefined;
				}

				const statusTransitions = getStatusTransitions(
					entry.status,
					STATUS_TRANSITIONS,
				);

				if (statusTransitions.length === 0) {
					return undefined;
				}

				if (!hasPermission(auth, 'cash-flow', 'update')) {
					return undefined;
				}

				if (entry.status === CashFlowStatusEnum.PENDING) {
					return 'complete';
				}

				return 'cancel';
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
					direction: { value: null, matchMode: 'equals' },
					category: { value: null, matchMode: 'equals' },
					method: { value: null, matchMode: 'equals' },
					currency: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					create_at_start: { value: null, matchMode: 'equals' },
					create_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
					client: { value: '', matchMode: 'equals' },
					client_id: { value: null, matchMode: 'equals' },
					employee: { value: '', matchMode: 'equals' },
					employee_id: { value: null, matchMode: 'equals' },
					vendor: { value: '', matchMode: 'equals' },
					vendor_id: { value: null, matchMode: 'equals' },
					company_vehicle: { value: '', matchMode: 'equals' },
					company_vehicle_id: { value: null, matchMode: 'equals' },
					cmr: { value: '', matchMode: 'equals' },
					cmr_id: { value: null, matchMode: 'equals' },
				} satisfies CashFlowDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'cash-flow',
							markDeleted: true,
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'category_type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.category_type),
						}),
				},
				{
					field: 'category',
					header: 'Category',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.category),
						}),
				},
				{
					field: 'amount',
					header: 'Net Amount',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayAmount({
								amount: entry.netAmount,
								currencyCode: entry.currency,
							}),
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
					field: 'external_reference',
					header: 'Reference',
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'cash-flow',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 160,
					maxWidth: 160,
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
				requestFind<CashFlowModel>('cash-flow', params),
		},
		displayEntryLabel: (entry: CashFlowModel) => {
			const formatted = formatAmount(entry.netAmount, entry.currency);

			return `${formatEnumLabel(entry.category)} ${formatted.value} ${formatted.currency}`;
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCashFlow,
				permission: ['cash-flow', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: CashFlowManageOutput) => {
					const params = prepareParamsFromFormValues(values);

					return requestCreate<CashFlowModel, typeof params>(
						'cash-flow',
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
			refund: {
				windowType: 'form',
				windowTitle: translations['refund.title'],
				windowComponent: FormManageCashFlow,
				permission: ['cash-flow', 'refund'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CashFlowModel) =>
					arrayHasValue(entry.status, REFUNDABLE_STATUSES),
				operationFunction: (values: CashFlowManageOutput) => {
					const params = prepareParamsFromFormValues(values);

					return requestCreate<CashFlowModel, typeof params>(
						'cash-flow',
						params,
					);
				},
				prepareEntry: (entry: CashFlowModel) => {
					return {
						category: CashFlowCategoryEnum.REFUND,
						method: entry.method,
						amount: -Math.abs(entry.amount),
						vat_rate: entry.vat_rate,
						currency: entry.currency,
						external_reference: entry.external_reference
							? `REFUND ${entry.external_reference}`
							: null,
						parent_id: entry.id,
					};
				},
				buttonPosition: 'right',
				button: {
					variant: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageCashFlow,
				permission: ['cash-flow', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CashFlowModel) =>
					arrayHasValue(entry.status, MUTABLE_STATUSES) &&
					!entry.deleted_at,
				operationFunction: (
					values: CashFlowManageOutput,
					id: number,
				) => {
					const params = prepareParamsFromFormValues(values);

					return requestUpdate<CashFlowModel, typeof params>(
						'cash-flow',
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
				permission: ['cash-flow', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CashFlowModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: CashFlowModel) =>
					requestDelete('cash-flow', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			complete: {
				windowType: 'action',
				windowTitle: translations['complete.title'],
				permission: ['cash-flow', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CashFlowModel) => {
					const statusTransitions = getStatusTransitions(
						entry.status,
						STATUS_TRANSITIONS,
					);

					return (
						!entry.deleted_at &&
						arrayHasValue(
							CashFlowStatusEnum.COMPLETED,
							statusTransitions,
						)
					);
				},
				operationFunction: (entry: CashFlowModel) =>
					requestUpdateStatus('cash-flow', entry, 'completed'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			cancel: {
				windowType: 'action',
				windowTitle: translations['cancel.title'],
				permission: ['cash-flow', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CashFlowModel) => {
					const statusTransitions = getStatusTransitions(
						entry.status,
						STATUS_TRANSITIONS,
					);

					return (
						!entry.deleted_at &&
						arrayHasValue(
							CashFlowStatusEnum.CANCELED,
							statusTransitions,
						)
					);
				},
				operationFunction: (entry: CashFlowModel) =>
					requestUpdateStatus('cash-flow', entry, 'canceled'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCashFlow,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['cash-flow', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
