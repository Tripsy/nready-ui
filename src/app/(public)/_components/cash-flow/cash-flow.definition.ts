import { z } from 'zod';
import {
	type CashFlowFormValuesType,
	FormManageCashFlow,
} from '@/app/(public)/_components/cash-flow/form-manage-cash-flow.component';
import { Configuration } from '@/config/settings.config';
import { translateBatch } from '@/config/translate.setup';
import { formatAmount } from '@/helpers/display.helper';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import {
	requestCreate,
	requestUpdate,
	requestUpdateStatus,
} from '@/helpers/services.helper';
import {
	calcNetAmount,
	formatEnumLabel,
	replaceVars,
} from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import {
	CashFlowCategoryEnum,
	CashFlowCategoryTypeEnum,
	CashFlowMethodEnum,
	type CashFlowModel,
	CashFlowStatusEnum,
	getExpectedCategoryType,
	getExpectedDirection,
	getOperationalRecordOptions,
	MUTABLE_STATUSES,
	type OperationalRecordType,
	OperationalRecordTypeEnum,
	STATUS_TRANSITIONS,
} from '@/models/cash-flow.model';
import { displayClientLabel } from '@/models/client.model';
import { CurrencyEnum } from '@/types/common.type';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_category',
	'invalid_method',
	'invalid_amount',
	'invalid_vat_rate',
	'invalid_currency',
	'invalid_external_reference',
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
			grossAmount: this.validateNumber(
				this.getMessage('invalid_amount'),
				{
					required: true,
					onlyPositive: false,
					allowDecimals: 2,
				},
			),
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
		grossAmount: getFormDataAsNumber(formData, 'grossAmount'),
		vat_rate: getFormDataAsNumber(formData, 'vat_rate') || 0,
		currency:
			getFormDataAsEnum(formData, 'currency', CurrencyEnum) ||
			Configuration.currency(),
		external_reference: getFormDataAsString(formData, 'external_reference'),
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
		vendor: getFormDataAsString(formData, 'vendor'),
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
			grossAmount: data?.grossAmount ?? null,
			vat_rate: data?.vat_rate ?? Configuration.get('app.vatRate'),
			currency: data?.currency ?? Configuration.currency(),
			external_reference: data?.external_reference ?? null,
			notes: data?.notes ?? null,

			// Operational records - Data is selected via form component for `update` action
			operational_records: {
				[OperationalRecordTypeEnum.CLIENT]:
					data?.operational_records.client?.id ?? null,
				[OperationalRecordTypeEnum.EMPLOYEE]:
					data?.operational_records.employee?.id ?? null,
				[OperationalRecordTypeEnum.VENDOR]:
					data?.operational_records.vendor?.id ?? null,
				[OperationalRecordTypeEnum.COMPANY_VEHICLE]:
					data?.operational_records.company_vehicle?.id ?? null,
				[OperationalRecordTypeEnum.CMR]:
					data?.operational_records.cmr?.id ?? null,
			},
			vendor: null,
		},
	};
}

type CashFlowManageOutput = ValidatorOutput<CashFlowValidator, 'manage'>;

function prepareParamsFromFormValues(data: CashFlowManageOutput) {
	const category_type = getExpectedCategoryType(data.category);
	const direction = getExpectedDirection(
		category_type,
		Number(data.grossAmount),
	);
	const netAmount = calcNetAmount(data.grossAmount, data.vat_rate);

	const { grossAmount, ...rest } = data;

	return {
		...rest,
		direction,
		category_type,
		amount: netAmount,
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CashFlowModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'complete.title',
			'cancel.title',
		] as const,
		'cash-flow.action',
	);

	return {
		displayEntryLabel: (entry: CashFlowModel) => {
			const formatted = formatAmount(entry.grossAmount, entry.currency);

			if (entry.category_type === CashFlowCategoryTypeEnum.REVENUE) {
				if (entry.operational_records.client) {
					return `${displayClientLabel(entry.operational_records.client)} ${formatted.value} ${formatted.currency}`;
				}

				return `${formatted.value} ${formatted.currency}`;
			}

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
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageCashFlow,
				permission: ['cash-flow', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CashFlowModel) =>
					arrayHasValue(entry.status, MUTABLE_STATUSES),
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

					return arrayHasValue(
						CashFlowStatusEnum.COMPLETED,
						statusTransitions,
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

					return arrayHasValue(
						CashFlowStatusEnum.CANCELED,
						statusTransitions,
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
		},
	};
}
