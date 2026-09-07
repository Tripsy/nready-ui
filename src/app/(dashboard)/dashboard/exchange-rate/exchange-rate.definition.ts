import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type ExchangeRateFormValuesType,
	FormManageExchangeRate,
} from '@/app/(dashboard)/dashboard/exchange-rate/form-manage-exchange-rate.component';
import { UsageGuideExchangeRate } from '@/app/(dashboard)/dashboard/exchange-rate/usage-guide-exchange-rate.component';
import { ViewExchangeRate } from '@/app/(dashboard)/dashboard/exchange-rate/view-exchange-rate.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestUpdate,
} from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	CURRENCY_CODE_CHARS,
	displayExchangeRateLabel,
	EXCHANGE_RATE_MAX_DECIMALS,
	type ExchangeRateModel,
	type ExchangeRateSource,
	ExchangeRateSourceLabels,
	isWithinUpdateWindow,
} from '@/models/exchange-rate.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

/**
 * `currency` and `rate_date` are create-only: together they identify the row, so the backend's
 * update payload has no slot for either and an update never carries one.
 */
export type ExchangeRateUpdateParamsType = Omit<
	ExchangeRateFormValuesType,
	'currency' | 'rate_date'
>;

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_currency',
	'invalid_rate',
	'invalid_rate_date',
	'invalid_notes',
] as const;

/** ISO 4217 alphabetic code, as the backend stores it. */
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

class ExchangeRateValidator extends BaseValidator<typeof validatorMessages> {
	private baseSchema = z.object({
		rate: this.validateNumber(
			{
				invalid: this.getMessage('invalid_rate'),
				max_decimals: this.getMessage('invalid_rate', {
					decimals: String(EXCHANGE_RATE_MAX_DECIMALS),
				}),
				only_positive: this.getMessage('only_positive'),
			},
			{ allowDecimals: EXCHANGE_RATE_MAX_DECIMALS },
		),
		notes: this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		}),
	});

	create = this.baseSchema.extend({
		/*
		 * Every constraint of the field carries the same message: the helpers fall back to
		 * their own English defaults for any key left unset, which would leak untranslated
		 * text into a form the user is reading in their own language.
		 */
		currency: this.validateString(
			{
				invalid: this.getMessage('invalid_currency'),
				min_chars: this.getMessage('invalid_currency'),
				max_chars: this.getMessage('invalid_currency'),
			},
			{
				minChars: CURRENCY_CODE_CHARS,
				maxChars: CURRENCY_CODE_CHARS,
			},
		).refine((value) => CURRENCY_CODE_PATTERN.test(value), {
			message: this.getMessage('invalid_currency'),
		}),
		// `maxFutureSeconds: 0` rejects any day after today while leaving today valid, matching
		// the backend - a rate is published for a day that has begun
		rate_date: this.validateDate(
			{
				invalid_date: this.getMessage('invalid_rate_date'),
				invalid_date_format: this.getMessage('invalid_rate_date'),
				invalid_past_date: this.getMessage('invalid_rate_date'),
				invalid_future_date: this.getMessage('invalid_rate_date'),
			},
			{ maxFutureSeconds: 0 },
		),
	});

	update = this.baseSchema;
}

async function buildValidator() {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'exchange-rate',
	);

	return new ExchangeRateValidator(translations);
}

async function validateFormCreate(values: ExchangeRateFormValuesType) {
	const validator = await buildValidator();

	return validator.create.safeParse(values);
}

async function validateFormUpdate(values: ExchangeRateFormValuesType) {
	const validator = await buildValidator();

	return validator.update.safeParse(values);
}

function getFormValues(formData: FormData): ExchangeRateFormValuesType {
	return {
		// Null on update: both fields are rendered disabled, so they submit nothing - and the
		// update schema drops them anyway.
		currency: getFormDataAsString(formData, 'currency'),
		rate: getFormDataAsNumber(formData, 'rate'),
		rate_date: getFormDataAsString(formData, 'rate_date'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: ExchangeRateModel,
): FormStateType<ExchangeRateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			currency: data?.currency ?? null,
			rate: data?.rate ?? null,
			rate_date: data?.rate_date ?? null,
			notes: data?.notes ?? null,
		},
	};
}

export type ExchangeRateDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	source: { value: ExchangeRateSource | null; matchMode: 'equals' };
	rate_date_start: { value: string | null; matchMode: 'equals' };
	rate_date_end: { value: string | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ExchangeRateModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'guide.title',
		] as const,
		'exchange-rate.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<ExchangeRateModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'exchange-rate', 'read')
					? 'view'
					: undefined,
			dataSource: 'exchange-rate',
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				// Newest first: the rates worth looking at are the ones just published
				sortField: 'rate_date',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					source: { value: null, matchMode: 'equals' },
					rate_date_start: { value: null, matchMode: 'equals' },
					rate_date_end: { value: null, matchMode: 'equals' },
				} satisfies ExchangeRateDataTableFiltersType,
			},
			// Only `id`, `rate_date` and `currency` are sortable - the three the backend's
			// `OrderByEnum` accepts.
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'rate_date',
					header: 'Rate Date',
					defaultWidth: 128,
					sortable: true,
				},
				{
					field: 'currency',
					header: 'Currency',
					defaultWidth: 112,
					sortable: true,
				},
				{
					// One unit of `currency` in `base_currency`, which is why the two are shown
					// together rather than as a bare number
					field: 'rate',
					header: 'Rate',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: `${entry.rate} ${entry.base_currency}`,
						}),
				},
				{
					field: 'source',
					header: 'Source',
					defaultWidth: 112,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: ExchangeRateSourceLabels[entry.source],
						}),
				},
				{
					field: 'provider',
					header: 'Provider',
					defaultWidth: 128,
				},
				{
					field: 'created_at',
					header: 'Created At',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<ExchangeRateModel>('exchange-rate', params),
		},
		displayEntryLabel: (entry: ExchangeRateModel) =>
			displayExchangeRateLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageExchangeRate,
				permission: ['exchange-rate', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: ExchangeRateFormValuesType) =>
					requestCreate<
						ExchangeRateModel,
						ExchangeRateFormValuesType
					>('exchange-rate', params),
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateFormCreate,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageExchangeRate,
				permission: ['exchange-rate', 'update'],
				entriesSelection: 'single',
				// The backend refuses an edit once the rate is older than its window, so the
				// button goes away rather than opening a form whose submit answers 400
				customEntryCheck: (entry: ExchangeRateModel) =>
					isWithinUpdateWindow(entry),
				operationFunction: (
					params: ExchangeRateUpdateParamsType,
					id: number,
				) =>
					requestUpdate<
						ExchangeRateModel,
						ExchangeRateUpdateParamsType
					>('exchange-rate', params, id),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateFormUpdate,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['exchange-rate', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: ExchangeRateModel) =>
					requestDelete('exchange-rate', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewExchangeRate,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['exchange-rate', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideExchangeRate,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['exchange-rate', 'read'],
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
