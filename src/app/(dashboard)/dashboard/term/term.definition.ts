import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageTerm,
	type TermFormValuesType,
} from '@/app/(dashboard)/dashboard/term/form-manage-term.component';
import { ViewTerm } from '@/app/(dashboard)/dashboard/term/view-term.component';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import { getFormDataAsEnum } from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	displayTermLabel,
	displayTermValue,
	type TermContentType,
	type TermModel,
	type TermType,
	TermTypeEnum,
} from '@/models/term.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_type',
	'invalid_language',
	'invalid_value',
	'invalid_value_max',
] as const;

/** Matches the backend's `VALUE_MAX_CHARS`, itself the width of `term_content.value`. */
const VALUE_MAX_CHARS = 255;

class TermValidator extends BaseValidator<typeof validatorMessages> {
	contentsSchema() {
		return z.object({
			language: this.validateLanguage(
				this.getMessage('invalid_language'),
			),
			// Mirrors the backend rule: every term is stored lower-cased, so what the editor
			// typed and what comes back on the next read are the same string.
			value: this.validateString(
				{
					invalid: this.getMessage('invalid_value'),
					max_chars: this.getMessage('invalid_value_max', {
						max: VALUE_MAX_CHARS,
					}),
				},
				{ maxChars: VALUE_MAX_CHARS },
			).transform((value) => value.trim().toLowerCase()),
		});
	}

	manage = () =>
		z.object({
			type: this.validateEnum(
				TermTypeEnum,
				this.getMessage('invalid_type'),
			),
			contents: this.contentsSchema()
				.array()
				.min(1, this.getMessage('invalid_contents'))
				.refine(
					(contents) => {
						const languages = contents.map(
							(content) => content.language,
						);

						return new Set(languages).size === languages.length;
					},
					{ message: this.getMessage('duplicate_contents') },
				),
		});
}

async function validateForm(values: TermFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'term',
	);

	const validator = new TermValidator(translations);

	return validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): TermFormValuesType {
	const contentsRaw = formData.get('contents');

	let contents: TermContentType[] = [];

	if (typeof contentsRaw === 'string' && contentsRaw.length > 0) {
		try {
			contents = JSON.parse(contentsRaw) as TermContentType[];
		} catch {
			contents = [];
		}
	}

	return {
		type:
			getFormDataAsEnum(formData, 'type', TermTypeEnum) ||
			TermTypeEnum.TAG,
		contents: contents,
	};
}

function getFormState(data?: TermModel): FormStateType<TermFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			type: data?.type ?? TermTypeEnum.TAG,
			contents: data?.contents ?? [],
		},
	};
}

export type TermDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	type: { value: TermType | null; matchMode: 'equals' };
	language: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<TermModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
		] as const,
		'term.action',
	);

	const defaultLanguage = Configuration.defaultLanguage();

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<TermModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'term', 'read') ? 'view' : undefined,
			dataSource: 'term',
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
					type: { value: null, matchMode: 'equals' },
					language: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies TermDataTableFiltersType,
			},
			// Only `id` is sortable: the backend's `OrderByEnum` lost `value` when the wording
			// moved to `term_content`, since ordering on it would mean picking a language first.
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
					field: 'type',
					header: 'Type',
					// `formatEnumLabel`, not `capitalize` — the values are snake_case, so
					// capitalizing alone leaves "Attribute_value" against the filter
					// dropdown's "Attribute Value".
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.type),
						}),
				},
				{
					/*
					 * The backend returns the one wording for the filtered language, so the row
					 * carries at most a single content. An empty cell means the term has no
					 * translation there — the state this table exists to surface.
					 */
					field: 'contents',
					header: 'Value',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							markDeleted: true,
							customValue: displayTermValue(
								entry,
								getLanguageClient(),
							),
						}),
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
				requestFind<TermModel>('term', params),
		},
		displayEntryLabel: (entry: TermModel) =>
			displayTermLabel(entry, defaultLanguage),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageTerm,
				permission: ['term', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: TermFormValuesType) =>
					requestCreate<TermModel, TermFormValuesType>(
						'term',
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
				windowComponent: FormManageTerm,
				permission: ['term', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: TermModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: TermFormValuesType, id: number) =>
					requestUpdate<TermModel, TermFormValuesType>(
						'term',
						params,
						id,
					),
				// The list already carries every translation, but the entry must be re-read
				// after a save so the form reopens on the stored set rather than the stale one
				reloadEntry: (id: number) => requestView<TermModel>('term', id),
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
				permission: ['term', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: TermModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: TermModel) =>
					requestDelete('term', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['term', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: TermModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: TermModel) =>
					requestRestore('term', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewTerm,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['term', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				// The list row carries only the filtered language; the details window shows
				// every wording, which is what `read` returns when no language is requested
				reloadEntry: (id: number) => requestView<TermModel>('term', id),
			},
		},
	};
}
