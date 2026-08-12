import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManagePlace,
	type PlaceFormValuesType,
} from '@/app/(dashboard)/dashboard/place/form-manage-place.component';
import { ViewPlace } from '@/app/(dashboard)/dashboard/place/view-place.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestView,
} from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	displayPlaceLabel,
	getPlaceContentProp,
	type PlaceContent,
	type PlaceModel,
	type PlaceType,
	PlaceTypeEnum,
} from '@/models/place.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Language } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_place_type',
	'invalid_code',
	'invalid_parent',
	'invalid_parent_id',
	'invalid_language',
	'invalid_name',
	'invalid_type_label',
] as const;

class PlaceValidator extends BaseValidator<typeof validatorMessages> {
	contentsSchema() {
		return z.object({
			language: this.validateLanguage(
				this.getMessage('invalid_language'),
			),
			name: this.validateString(this.getMessage('invalid_name')),
			type_label: this.validateString(
				this.getMessage('invalid_type_label'),
			),
		});
	}

	manage = (isSubmit: boolean = true) =>
		z
			.object({
				place_type: this.validateEnum(
					PlaceTypeEnum,
					this.getMessage('invalid_place_type'),
				),
				code: this.validateString(this.getMessage('invalid_code'), {
					required: false,
				}),
				parent_id: this.validateId(
					this.getMessage('invalid_parent_id'),
					{
						required: false,
					},
				),
				parent: this.validateString(this.getMessage('invalid_parent'), {
					required: false,
				}),
				contents: this.contentsSchema().array(),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.parent && !data.parent_id) {
					ctx.addIssue({
						path: ['parent'],
						message: this.getMessage('invalid_parent_id'),
						code: 'custom',
					});
				}
			})
			.superRefine((data, ctx) => {
				if (data.contents.length === 0) {
					ctx.addIssue({
						path: ['contents', 0, 'name'],
						message: this.getMessage('invalid_contents'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: PlaceFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'place',
	);

	const validator = new PlaceValidator(translations);

	const normalizedValues = {
		...values,
		contents: Object.values(values.contents).filter(
			(c): c is PlaceContent => !!c,
		),
	};

	return validator.manage(isSubmit).safeParse(normalizedValues);
}

function getFormValues(formData: FormData): PlaceFormValuesType {
	const contentsRaw = formData.get('contents');

	let contents: PlaceContent[] = [];

	if (typeof contentsRaw === 'string' && contentsRaw.length > 0) {
		try {
			contents = JSON.parse(contentsRaw) as PlaceContent[];
		} catch {
			contents = [];
		}
	}

	return {
		place_type:
			getFormDataAsEnum(formData, 'place_type', PlaceTypeEnum) ||
			PlaceTypeEnum.CITY,
		code: getFormDataAsString(formData, 'code'),
		parent_id: getFormDataAsNumber(formData, 'parent_id'),
		parent: getFormDataAsString(formData, 'parent'),
		contents: contents,
	};
}

function getFormState(data?: PlaceModel): FormStateType<PlaceFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			place_type: data?.place_type ?? PlaceTypeEnum.CITY,
			code: data?.code ?? null,
			parent_id: data?.parent?.id ?? null,
			parent: data?.parent
				? getPlaceContentProp(data?.parent, getLanguageClient(), 'name')
				: null,
			contents: data?.contents ?? [],
		},
	};
}

export type PlaceDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	place_type: { value: PlaceType | null; matchMode: 'equals' };
	language: { value: Language | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<PlaceModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
		] as const,
		'place.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<PlaceModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'place', 'read') ? 'view' : undefined,
			dataSource: 'place',
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
					place_type: { value: null, matchMode: 'equals' },
					language: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies PlaceDataTableFiltersType,
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
					field: 'place_type',
					header: 'Type',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'code',
					header: 'Code',
					sortable: true,
				},
				{
					field: 'name',
					header: 'Name',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: getPlaceContentProp(
								entry,
								getLanguageClient(),
								'name',
							),
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
				requestFind<PlaceModel>('place', params),
		},
		displayEntryLabel: (entry: PlaceModel) => {
			return displayPlaceLabel(entry, getLanguageClient());
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManagePlace,
				permission: ['place', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: PlaceFormValuesType) =>
					requestCreate<PlaceModel, PlaceFormValuesType>(
						'place',
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
				windowComponent: FormManagePlace,
				permission: ['place', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: PlaceModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: PlaceFormValuesType, id: number) =>
					requestUpdate<PlaceModel, PlaceFormValuesType>(
						'place',
						params,
						id,
					),
				reloadEntry: (id: number) =>
					requestView<PlaceModel>('place', id),
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
				permission: ['place', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: PlaceModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: PlaceModel) =>
					requestDelete('place', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['place', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: PlaceModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: PlaceModel) =>
					requestRestore('place', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewPlace,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['place', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				reloadEntry: (id: number) =>
					requestView<PlaceModel>('place', id),
			},
		},
	};
}
