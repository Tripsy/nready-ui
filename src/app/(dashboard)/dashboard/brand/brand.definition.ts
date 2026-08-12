import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type BrandFormValuesType,
	FormManageBrand,
} from '@/app/(dashboard)/dashboard/brand/form-manage-brand.component';
import { ViewBrand } from '@/app/(dashboard)/dashboard/brand/view-brand.component';
import Routes from '@/config/routes.setup';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsEnum, getFormDataAsString } from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestUpdateStatus,
	requestView,
} from '@/helpers/services.helper';
import { toKebabCase } from '@/helpers/string.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	BRAND_DEFAULT_TYPE,
	type BrandContentType,
	type BrandModel,
	type BrandStatus,
	BrandStatusEnum,
	type BrandType,
	BrandTypeEnum,
	displayBrandLabel,
} from '@/models/brand.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { Language } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_brand_type',
	'invalid_name',
	'invalid_slug',
	'invalid_language',
	'invalid_description',
	'invalid_meta_title',
	'invalid_meta_description',
	'invalid_meta_keywords',
] as const;

class BrandValidator extends BaseValidator<typeof validatorMessages> {
	contentsSchema() {
		return z.object({
			language: this.validateLanguage(
				this.getMessage('invalid_language'),
			),
			description: this.validateString(
				this.getMessage('invalid_description'),
				{ required: false },
			),
			meta: this.validateMeta({
				invalid_meta_title: this.getMessage('invalid_meta_title'),
				invalid_meta_description: this.getMessage(
					'invalid_meta_description',
				),
				invalid_meta_keywords: this.getMessage('invalid_meta_keywords'),
			}),
		});
	}

	manage = () =>
		z.object({
			name: this.validateString(this.getMessage('invalid_name')),
			slug: this.validateString(this.getMessage('invalid_slug'), {
				required: false,
			}),
			brand_type: this.validateEnum(
				BrandTypeEnum,
				this.getMessage('invalid_brand_type'),
			),
			contents: this.contentsSchema().array(),
		});
}

async function validateForm(values: BrandFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'brand',
	);

	const validator = new BrandValidator(translations);

	const normalizedValues = {
		...values,
		contents: Object.values(values.contents).filter(
			(c): c is BrandContentType => !!c,
		),
	};

	return validator.manage().safeParse(normalizedValues);
}

function getFormValues(formData: FormData): BrandFormValuesType {
	const contentsRaw = formData.get('contents');

	let contents: BrandContentType[] = [];

	if (typeof contentsRaw === 'string' && contentsRaw.length > 0) {
		try {
			contents = JSON.parse(contentsRaw) as BrandContentType[];
		} catch {
			contents = [];
		}
	}

	const values = {
		brand_type:
			getFormDataAsEnum(formData, 'brand_type', BrandTypeEnum) ||
			BRAND_DEFAULT_TYPE,
		name: getFormDataAsString(formData, 'name'),
		contents: contents,
	};

	return {
		...values,
		// `toKebabCase` strips anything outside the latin alphabet, so a wholly non-latin name
		// (`Москва`) reduces to an empty string. Send `null` rather than `''` — the id that
		// would make a usable fallback does not exist yet at create time, so this stays an
		// open case rather than being papered over with a meaningless slug.
		slug: values.name ? toKebabCase(values.name) || null : null,
	};
}

function getFormState(data?: BrandModel): FormStateType<BrandFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			brand_type: data?.brand_type ?? BRAND_DEFAULT_TYPE,
			name: data?.name ?? null,
			slug: data?.slug ?? null,
			contents: data?.contents ?? [],
		},
	};
}

export type BrandDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	brand_type: { value: BrandType | null; matchMode: 'equals' };
	status: { value: BrandStatus | null; matchMode: 'equals' };
	language: { value: Language | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<BrandModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'enable.title',
			'disable.title',
			'order.title',
		] as const,
		'brand.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<BrandModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'brand', 'read') ? 'view' : undefined,
			dataSource: 'brand',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<BrandModel>['displayButton'] {
		return {
			action: (entry: BrandModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'brand', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'brand', 'update')) {
					return undefined;
				}

				return entry.status === BrandStatusEnum.ACTIVE
					? 'disable'
					: 'enable';
			},
			dataSource: 'brand',
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
					brand_type: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					language: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies BrandDataTableFiltersType,
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
					field: 'brand_type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'name',
					header: 'Name',
					sortable: true,
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'brand',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<BrandModel>('brand', params),
		},
		displayEntryLabel: (entry: BrandModel) => {
			return displayBrandLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageBrand,
				permission: ['brand', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: BrandFormValuesType) =>
					requestCreate<BrandModel, BrandFormValuesType>(
						'brand',
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
				windowComponent: FormManageBrand,
				permission: ['brand', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: BrandModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: BrandFormValuesType, id: number) =>
					requestUpdate<BrandModel, BrandFormValuesType>(
						'brand',
						params,
						id,
					),
				reloadEntry: (id: number) =>
					requestView<BrandModel>('brand', id),
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
				permission: ['brand', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: BrandModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: BrandModel) =>
					requestDelete('brand', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['brand', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: BrandModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: BrandModel) =>
					requestRestore('brand', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['brand', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: BrandModel) =>
					!entry.deleted_at &&
					entry.status === BrandStatusEnum.INACTIVE,
				operationFunction: (entry: BrandModel) =>
					requestUpdateStatus('brand', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['brand', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: BrandModel) =>
					!entry.deleted_at &&
					entry.status === BrandStatusEnum.ACTIVE,
				operationFunction: (entry: BrandModel) =>
					requestUpdateStatus('brand', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewBrand,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['brand', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
				reloadEntry: (id: number) =>
					requestView<BrandModel>('brand', id),
			},
			order: {
				windowType: 'link',
				windowTitle: translations['order.title'],
				windowTarget: Routes.get('brand-order'),
				permission: ['brand', 'update'],
				entriesSelection: 'free',
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
			},
		},
	};
}
