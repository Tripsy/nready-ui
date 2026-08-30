import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type DocumentSeriesFormValuesType,
	FormManageDocumentSeries,
} from '@/app/(dashboard)/dashboard/document-series/form-manage-document-series.component';
import { UsageGuideDocumentSeries } from '@/app/(dashboard)/dashboard/document-series/usage-guide-document-series.component';
import { ViewDocumentSeries } from '@/app/(dashboard)/dashboard/document-series/view-document-series.component';
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
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	DOCUMENT_SERIES_CODE_MAX_CHARS,
	DOCUMENT_SERIES_DEFAULT_START_NUMBER,
	type DocumentSeriesModel,
	type DocumentType,
	DocumentTypeEnum,
	DocumentTypeLabels,
	displayDocumentSeriesLabel,
} from '@/models/document-series.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

/**
 * `document_type` is create-only: it is the key the counter is stored under, so the backend's
 * update payload has no slot for it and an update never carries one.
 */
export type DocumentSeriesUpdateParamsType = Omit<
	DocumentSeriesFormValuesType,
	'document_type'
>;

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_document_type',
	'invalid_code',
	'invalid_start_number',
	'invalid_notes',
] as const;

class DocumentSeriesValidator extends BaseValidator<typeof validatorMessages> {
	private baseSchema = z.object({
		/*
		 * Every constraint of a field is spelled out with the same message: the helpers fall
		 * back to their own English defaults for any key left unset, which would leak
		 * untranslated text into a form the user is reading in their own language.
		 */
		code: this.validateString(
			{
				invalid: this.getMessage('invalid_code', {
					max: DOCUMENT_SERIES_CODE_MAX_CHARS,
				}),
				max_chars: this.getMessage('invalid_code', {
					max: DOCUMENT_SERIES_CODE_MAX_CHARS,
				}),
			},
			{ maxChars: DOCUMENT_SERIES_CODE_MAX_CHARS },
		),
		start_number: this.validateNumber({
			invalid: this.getMessage('invalid_start_number'),
			no_decimals: this.getMessage('invalid_start_number'),
			only_positive: this.getMessage('only_positive'),
		}),
		notes: this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		}),
	});

	create = this.baseSchema.extend({
		document_type: this.validateEnum(
			DocumentTypeEnum,
			this.getMessage('invalid_document_type'),
		),
	});

	update = this.baseSchema;
}

async function buildValidator() {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'document-series',
	);

	return new DocumentSeriesValidator(translations);
}

async function validateFormCreate(values: DocumentSeriesFormValuesType) {
	const validator = await buildValidator();

	return validator.create.safeParse(values);
}

async function validateFormUpdate(values: DocumentSeriesFormValuesType) {
	const validator = await buildValidator();

	return validator.update.safeParse(values);
}

function getFormValues(formData: FormData): DocumentSeriesFormValuesType {
	return {
		// Null on update: the field is rendered disabled, so it submits nothing — and the
		// update schema drops it anyway.
		document_type: getFormDataAsEnum(
			formData,
			'document_type',
			DocumentTypeEnum,
		),
		code: getFormDataAsString(formData, 'code'),
		start_number: getFormDataAsNumber(formData, 'start_number'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: DocumentSeriesModel,
): FormStateType<DocumentSeriesFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			document_type: data?.document_type ?? null,
			code: data?.code ?? null,
			start_number:
				data?.start_number ?? DOCUMENT_SERIES_DEFAULT_START_NUMBER,
			notes: data?.notes ?? null,
		},
	};
}

export type DocumentSeriesDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	document_type: { value: DocumentType | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<DocumentSeriesModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'guide.title',
		] as const,
		'document-series.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<DocumentSeriesModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'document-series', 'read')
					? 'view'
					: undefined,
			dataSource: 'document-series',
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
					document_type: { value: null, matchMode: 'equals' },
				} satisfies DocumentSeriesDataTableFiltersType,
			},
			// Only `id` and `code` are sortable — they are the two columns the backend's
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
					field: 'document_type',
					header: 'Document Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue:
								DocumentTypeLabels[entry.document_type],
						}),
				},
				{
					field: 'code',
					header: 'Code',
					sortable: true,
				},
				{
					field: 'start_number',
					header: 'Start Number',
					defaultWidth: 128,
				},
				{
					// The counter only moves through an allocation, so this is the number the
					// next document issued against this series will carry.
					field: 'next_number',
					header: 'Next Number',
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
				requestFind<DocumentSeriesModel>('document-series', params),
		},
		displayEntryLabel: (entry: DocumentSeriesModel) =>
			displayDocumentSeriesLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageDocumentSeries,
				permission: ['document-series', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: DocumentSeriesFormValuesType) =>
					requestCreate<
						DocumentSeriesModel,
						DocumentSeriesFormValuesType
					>('document-series', params),
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
				windowComponent: FormManageDocumentSeries,
				permission: ['document-series', 'update'],
				entriesSelection: 'single',
				operationFunction: (
					params: DocumentSeriesUpdateParamsType,
					id: number,
				) =>
					requestUpdate<
						DocumentSeriesModel,
						DocumentSeriesUpdateParamsType
					>('document-series', params, id),
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
				permission: ['document-series', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: DocumentSeriesModel) =>
					requestDelete('document-series', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewDocumentSeries,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['document-series', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideDocumentSeries,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['document-series', 'read'],
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
