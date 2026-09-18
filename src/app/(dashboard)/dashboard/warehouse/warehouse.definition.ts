import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageWarehouse,
	type WarehouseFormValuesType,
} from '@/app/(dashboard)/dashboard/warehouse/form-manage-warehouse.component';
import { UsageGuideWarehouse } from '@/app/(dashboard)/dashboard/warehouse/usage-guide-warehouse.component';
import { ViewWarehouse } from '@/app/(dashboard)/dashboard/warehouse/view-warehouse.component';
import { Icons } from '@/components/icon.component';
import { translateBatch } from '@/config/translate.setup';
import { DisplayFlagged } from '@/helpers/display.helper';
import {
	getFormDataAsBoolean,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestUpdateStatus,
} from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AccountModel, hasPermission } from '@/models/account.model';
import {
	displayWarehouseLabel,
	WAREHOUSE_CODE_MAX_LENGTH,
	type WarehouseModel,
	type WarehouseStatus,
	WarehouseStatusEnum,
} from '@/models/warehouse.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_name',
	'invalid_code',
	'invalid_address_id',
] as const;

class WarehouseValidator extends BaseValidator<typeof validatorMessages> {
	manage = () =>
		z.object({
			address_id: this.validateId(this.getMessage('invalid_address_id')),
			code: this.validateString(this.getMessage('invalid_code'), {
				maxChars: WAREHOUSE_CODE_MAX_LENGTH,
			}),
			name: this.validateString(this.getMessage('invalid_name')),
			is_default: z.boolean(),
			notes: z.string().nullable(),
		});
}

async function validateForm(values: WarehouseFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'warehouse.validation',
	);

	const validator = new WarehouseValidator(translations);

	return validator.manage().safeParse(values);
}

/**
 * `address` is the autocomplete's visible text and is not submitted - the backend takes the id
 * alone. It stays in the form values so a failed submit redraws the box with what was picked.
 */
function getFormValues(formData: FormData): WarehouseFormValuesType {
	return {
		address_id: getFormDataAsNumber(formData, 'address_id'),
		address: getFormDataAsString(formData, 'address_label'),
		code: getFormDataAsString(formData, 'code'),
		name: getFormDataAsString(formData, 'name'),
		is_default: getFormDataAsBoolean(formData, 'is_default'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: WarehouseModel,
): FormStateType<WarehouseFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			address_id: data?.address_id ?? null,
			// The joined address carries no city, so this is the street line alone
			address: data?.address?.details ?? null,
			code: data?.code ?? null,
			name: data?.name ?? null,
			is_default: data?.is_default ?? false,
			notes: data?.notes ?? null,
		},
	};
}

export type WarehouseDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: WarehouseStatus | null; matchMode: 'equals' };
	is_default: { value: boolean | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<WarehouseModel>
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
			'guide.title',
		] as const,
		'warehouse.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<WarehouseModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'warehouse', 'read') ? 'view' : undefined,
			dataSource: 'warehouse',
		};
	}

	function displayButtonStatus(
		auth: AccountModel | null,
	): DataTableValueOptionsType<WarehouseModel>['displayButton'] {
		return {
			action: (entry: WarehouseModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'warehouse', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'warehouse', 'update')) {
					return undefined;
				}

				return entry.status === WarehouseStatusEnum.ACTIVE
					? 'disable'
					: 'enable';
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
					status: { value: null, matchMode: 'equals' },
					is_default: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies WarehouseDataTableFiltersType,
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
					field: 'code',
					header: 'Code',
					sortable: true,
				},
				{
					// The default is flagged on the name rather than given a column of its
					// own: at most one row in the table can carry it, so a dedicated column
					// would be blank on every line but one
					field: 'name',
					header: 'Name',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: DisplayFlagged({
								value: entry.name,
								isFlagged: entry.is_default,
								icon: Icons.Star,
								title: 'Default warehouse',
							}),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'warehouse',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
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
				requestFind<WarehouseModel>('warehouse', params),
		},
		displayEntryLabel: (entry: WarehouseModel) =>
			displayWarehouseLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageWarehouse,
				permission: ['warehouse', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: WarehouseFormValuesType) =>
					requestCreate<WarehouseModel, WarehouseFormValuesType>(
						'warehouse',
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
				windowComponent: FormManageWarehouse,
				permission: ['warehouse', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WarehouseModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: WarehouseFormValuesType,
					id: number,
				) =>
					requestUpdate<WarehouseModel, WarehouseFormValuesType>(
						'warehouse',
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
				permission: ['warehouse', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WarehouseModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: WarehouseModel) =>
					requestDelete('warehouse', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['warehouse', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WarehouseModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: WarehouseModel) =>
					requestRestore('warehouse', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['warehouse', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WarehouseModel) =>
					!entry.deleted_at &&
					entry.status === WarehouseStatusEnum.INACTIVE,
				operationFunction: (entry: WarehouseModel) =>
					requestUpdateStatus('warehouse', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['warehouse', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WarehouseModel) =>
					!entry.deleted_at &&
					entry.status === WarehouseStatusEnum.ACTIVE,
				operationFunction: (entry: WarehouseModel) =>
					requestUpdateStatus('warehouse', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewWarehouse,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['warehouse', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideWarehouse,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['warehouse', 'read'],
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
