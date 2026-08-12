import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageTemplate,
	type TemplateFormValuesType,
} from '@/app/(dashboard)/dashboard/template/form-manage-template.component';
import { ViewTemplate } from '@/app/(dashboard)/dashboard/template/view-template.component';
import { Configuration } from '@/config/settings.config';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsEnum, getFormDataAsString } from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
} from '@/helpers/services.helper';
import { parseJson, toKebabCase } from '@/helpers/string.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type TemplateLayoutEmail,
	TemplateLayoutEmailEnum,
	type TemplateLayoutPage,
	TemplateLayoutPageEnum,
	type TemplateModel,
	type TemplateType,
	TemplateTypeEnum,
} from '@/models/template.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import { LanguageEnum } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_label',
	'invalid_language',
	'invalid_email_subject',
	'invalid_email_text',
	'invalid_email_html',
	'invalid_email_layout',
	'invalid_page_title',
	'invalid_page_html',
	'invalid_page_layout',
] as const;

class TemplateValidator extends BaseValidator<typeof validatorMessages> {
	baseSchema = {
		label: this.validateString(this.getMessage('invalid_label')),
		language: this.validateLanguage(this.getMessage('invalid_language')),
	};

	manage = z.discriminatedUnion('type', [
		// Email schema
		z
			.object({
				type: z.literal(TemplateTypeEnum.EMAIL),
				content: z.object({
					subject: this.validateString(
						this.getMessage('invalid_email_subject'),
					),
					text: this.validateString(
						this.getMessage('invalid_email_text'),
						{
							required: false,
						},
					),
					html: this.validateString(
						this.getMessage('invalid_email_html'),
					),
					layout: this.validateEnum(
						TemplateLayoutEmailEnum,
						this.getMessage('invalid_email_layout'),
					),
				}),
			})
			.extend(this.baseSchema),

		// Page schema
		z
			.object({
				type: z.literal(TemplateTypeEnum.PAGE),
				content: z.object({
					title: this.validateString(
						this.getMessage('invalid_page_title'),
					),
					html: this.validateString(
						this.getMessage('invalid_page_html'),
					),
					layout: this.validateEnum(
						TemplateLayoutPageEnum,
						this.getMessage('invalid_page_layout'),
					),
				}),
			})
			.extend(this.baseSchema),
	]);
}

async function validateForm(values: TemplateFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'template.validation',
	);

	const validator = new TemplateValidator(translations);

	return validator.manage.safeParse(values);
}

export function getFormValues(formData: FormData): TemplateFormValuesType {
	const type =
		getFormDataAsEnum(formData, 'type', TemplateTypeEnum) ||
		TemplateTypeEnum.EMAIL;

	const label = getFormDataAsString(formData, 'label');

	const base = {
		// An all-non-latin label kebab-cases to an empty string; `null` says "no label"
		// rather than passing `''` off as one.
		label: label ? toKebabCase(label) || null : null,
		language:
			getFormDataAsEnum(formData, 'language', LanguageEnum) ||
			Configuration.defaultLanguage(),
	};

	if (type === TemplateTypeEnum.EMAIL) {
		return {
			...base,
			type: TemplateTypeEnum.EMAIL,
			content: {
				subject: getFormDataAsString(formData, 'subject'),
				html: getFormDataAsString(formData, 'html'),
				text: getFormDataAsString(formData, 'text'),
				layout:
					getFormDataAsEnum(
						formData,
						'layout',
						TemplateLayoutEmailEnum,
					) || TemplateLayoutEmailEnum.DEFAULT,
			},
		};
	}

	return {
		...base,
		type: TemplateTypeEnum.PAGE,
		content: {
			title: getFormDataAsString(formData, 'title'),
			html: getFormDataAsString(formData, 'html'),
			layout:
				getFormDataAsEnum(formData, 'layout', TemplateLayoutPageEnum) ||
				TemplateLayoutPageEnum.DEFAULT,
		},
	};
}

function getFormState(
	data?: TemplateModel,
): FormStateType<TemplateFormValuesType> {
	const type = data?.type ?? TemplateTypeEnum.EMAIL;

	const state = {
		errors: {},
		message: null,
		situation: null,
		values: {
			label: data?.label ?? null,
			language: data?.language ?? LanguageEnum.EN,
			type: type,
		},
	};

	if (type === TemplateTypeEnum.EMAIL) {
		const parsedContent = parseJson(data?.content);
		const parsed =
			parsedContent && typeof parsedContent === 'object'
				? (parsedContent as {
						subject?: string;
						html?: string;
						layout?: TemplateLayoutEmail;
					})
				: {};

		return {
			...state,
			values: {
				...state.values,
				content: {
					subject: parsed.subject ?? null,
					html: parsed.html ?? null,
					layout: parsed.layout ?? TemplateLayoutEmailEnum.DEFAULT,
				},
			},
		};
	}

	const parsedContent = parseJson(data?.content);
	const parsed =
		parsedContent && typeof parsedContent === 'object'
			? (parsedContent as {
					title?: string;
					html?: string;
					layout?: TemplateLayoutPage;
				})
			: {};

	return {
		...state,
		values: {
			...state.values,
			content: {
				title: parsed.title ?? null,
				html: parsed.html ?? null,
				layout: parsed.layout ?? TemplateLayoutPageEnum.DEFAULT,
			},
		},
	};
}

export type TemplateDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	language: { value: string | null; matchMode: 'equals' };
	type: { value: TemplateType | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<TemplateModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
		] as const,
		'template.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<TemplateModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'template', 'read') ? 'view' : undefined,
			dataSource: 'template',
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
					language: { value: null, matchMode: 'equals' },
					type: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies TemplateDataTableFiltersType,
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
					field: 'label',
					header: 'Label',
					sortable: true,
				},
				{
					field: 'language',
					header: 'Language',
				},
				{
					field: 'type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
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
				requestFind<TemplateModel>('template', params),
		},
		displayEntryLabel: (entry: TemplateModel) => {
			return `[${entry.type}] ${entry.label}`;
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageTemplate,
				windowConfigProps: {
					size: 'x4l',
				},
				permission: ['template', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: TemplateFormValuesType) =>
					requestCreate<TemplateModel, TemplateFormValuesType>(
						'template',
						params,
					),
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
				windowComponent: FormManageTemplate,
				windowConfigProps: {
					size: 'x4l',
				},
				permission: ['template', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: TemplateModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: TemplateFormValuesType,
					id: number,
				) =>
					requestUpdate<TemplateModel, TemplateFormValuesType>(
						'template',
						params,
						id,
					),
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
				permission: ['template', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: TemplateModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: TemplateModel) =>
					requestDelete('template', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['template', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: TemplateModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: TemplateModel) =>
					requestRestore('template', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewTemplate,
				windowConfigProps: {
					size: 'x4l',
				},
				permission: ['template', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
