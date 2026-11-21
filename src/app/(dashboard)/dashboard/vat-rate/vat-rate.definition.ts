import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageVatRate,
	type VatRateFormValuesType,
} from '@/app/(dashboard)/dashboard/vat-rate/form-manage-vat-rate.component';
import { UsageGuideVatRate } from '@/app/(dashboard)/dashboard/vat-rate/usage-guide-vat-rate.component';
import { ViewVatRate } from '@/app/(dashboard)/dashboard/vat-rate/view-vat-rate.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
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
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	COUNTRY_CODE_CHARS,
	displayVatRateLabel,
	VAT_RATE_MAX_DECIMALS,
	type VatRateCategory,
	VatRateCategoryEnum,
	type VatRateModel,
} from '@/models/vat-rate.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { EntityId } from '@/types/entity-id.type';
import type { FormStateType } from '@/types/form.type';

/**
 * `country_code`, `category` and `valid_from` are create-only: together they identify the row, so
 * the backend's update payload has no slot for any of them.
 */
export type VatRateUpdateParamsType = Omit<
	VatRateFormValuesType,
	'country_code' | 'category' | 'valid_from'
>;

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_country_code',
	'invalid_category',
	'invalid_rate',
	'invalid_valid_from',
	'invalid_notes',
] as const;

/** ISO 3166-1 alpha-2, as the backend stores it. */
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

class VatRateValidator extends BaseValidator<typeof validatorMessages> {
	/** One message for every way a rate fails; it names the decimal limit, so it needs the value. */
	private rateMessage() {
		return this.getMessage('invalid_rate', {
			decimals: String(VAT_RATE_MAX_DECIMALS),
		});
	}

	private baseSchema = z.object({
		// 0 is a legal rate for a rated class; 100 or more is a typo the column check refuses
		rate: this.validateNumber(
			{
				invalid: this.rateMessage(),
				max_decimals: this.rateMessage(),
			},
			{ onlyPositive: false, allowDecimals: VAT_RATE_MAX_DECIMALS },
		).refine((value) => value >= 0 && value < 100, {
			message: this.rateMessage(),
		}),
		notes: this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		}),
	});

	create = this.baseSchema.extend({
		country_code: this.validateString(
			{
				invalid: this.getMessage('invalid_country_code'),
				min_chars: this.getMessage('invalid_country_code'),
				max_chars: this.getMessage('invalid_country_code'),
			},
			{
				minChars: COUNTRY_CODE_CHARS,
				maxChars: COUNTRY_CODE_CHARS,
			},
		).refine((value) => COUNTRY_CODE_PATTERN.test(value), {
			message: this.getMessage('invalid_country_code'),
		}),
		category: this.validateEnum(
			VatRateCategoryEnum,
			this.getMessage('invalid_category'),
		),
		valid_from: this.validateDate({
			invalid_date: this.getMessage('invalid_valid_from'),
			invalid_date_format: this.getMessage('invalid_valid_from'),
			invalid_past_date: this.getMessage('invalid_valid_from'),
			invalid_future_date: this.getMessage('invalid_valid_from'),
		}),
	});

	update = this.baseSchema;
}

async function buildValidator() {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'vat-rate',
	);

	return new VatRateValidator(translations);
}

async function validateFormCreate(values: VatRateFormValuesType) {
	const validator = await buildValidator();

	return validator.create.safeParse(values);
}

async function validateFormUpdate(values: VatRateFormValuesType) {
	const validator = await buildValidator();

	return validator.update.safeParse(values);
}

function getFormValues(formData: FormData): VatRateFormValuesType {
	return {
		// Null on update: the identity fields are rendered disabled, so they submit nothing - and
		// the update schema drops them anyway.
		country_code: getFormDataAsString(formData, 'country_code'),
		category: getFormDataAsEnum(formData, 'category', VatRateCategoryEnum),
		rate: getFormDataAsNumber(formData, 'rate'),
		valid_from: getFormDataAsString(formData, 'valid_from'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: VatRateModel,
): FormStateType<VatRateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			country_code: data?.country_code ?? null,
			category: data?.category ?? null,
			rate: data?.rate ?? null,
			valid_from: data?.valid_from ?? null,
			notes: data?.notes ?? null,
		},
	};
}

export type VatRateDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	category: { value: VatRateCategory | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<VatRateModel>
> {
	const [translations, labels] = await Promise.all([
		translateBatch(
			[
				'create.title',
				'update.title',
				'view.title',
				'delete.title',
				'guide.title',
			] as const,
			'vat-rate.action',
		),
		translateBatch(
			[
				'field.id',
				'field.country_code',
				'field.category',
				'field.rate',
				'field.valid_from',
				'field.created_at',
				...enumTranslationKeys('enum.category', VatRateCategoryEnum),
			] as const,
			'vat-rate',
		),
	]);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<VatRateModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'vat-rate', 'read') ? 'view' : undefined,
			dataSource: 'vat-rate',
		};
	}

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				// Newest first: the rows worth looking at are the ones in force or about to be
				sortField: 'valid_from',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					category: { value: null, matchMode: 'equals' },
				} satisfies VatRateDataTableFiltersType,
			},
			// Only `id`, `country_code` and `valid_from` are sortable - the three the backend's
			// `OrderByEnum` accepts.
			columns: [
				{
					field: 'country_code',
					header: labels['field.country_code'],
					defaultWidth: 112,
					sortable: true,
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							displayButton: displayButtonView(auth),
						}),
				},
				{
					field: 'category',
					header: labels['field.category'],
					defaultWidth: 160,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: translateEnumLabel(
								labels,
								'enum.category',
								entry.category,
							),
						}),
				},
				{
					field: 'rate',
					header: labels['field.rate'],
					defaultWidth: 96,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: `${entry.rate}%`,
						}),
				},
				{
					field: 'valid_from',
					header: labels['field.valid_from'],
					defaultWidth: 128,
					sortable: true,
				},
				{
					field: 'created_at',
					header: labels['field.created_at'],
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<VatRateModel>('vat-rate', params),
		},
		displayEntryLabel: (entry: VatRateModel) => displayVatRateLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageVatRate,
				permission: ['vat-rate', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: VatRateFormValuesType) =>
					requestCreate<VatRateModel, VatRateFormValuesType>(
						'vat-rate',
						params,
					),
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
				windowComponent: FormManageVatRate,
				permission: ['vat-rate', 'update'],
				entriesSelection: 'single',
				operationFunction: (
					params: VatRateUpdateParamsType,
					id: EntityId,
				) =>
					requestUpdate<VatRateModel, VatRateUpdateParamsType>(
						'vat-rate',
						params,
						id,
					),
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
				permission: ['vat-rate', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: VatRateModel) =>
					requestDelete('vat-rate', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewVatRate,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['vat-rate', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideVatRate,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['vat-rate', 'read'],
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
