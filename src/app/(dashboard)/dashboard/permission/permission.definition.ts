import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManagePermission,
	type PermissionFormValuesType,
} from '@/app/(dashboard)/dashboard/permission/form-manage-permission.component';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsString } from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
} from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import type { PermissionModel } from '@/models/permission.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = ['invalid_entity', 'invalid_operation'] as const;

class PermissionValidator extends BaseValidator<typeof validatorMessages> {
	manage = z.object({
		entity: this.validateString(this.getMessage('invalid_entity')),
		operation: this.validateString(this.getMessage('invalid_operation')),
	});
}

async function validateForm(values: PermissionFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'permission.validation',
	);

	const validator = new PermissionValidator(translations);

	return validator.manage.safeParse(values);
}

function getFormValues(formData: FormData): PermissionFormValuesType {
	return {
		entity: getFormDataAsString(formData, 'entity'),
		operation: getFormDataAsString(formData, 'operation'),
	};
}

function getFormState(
	data?: PermissionModel,
): FormStateType<PermissionFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			entity: data?.entity ?? null,
			operation: data?.operation ?? null,
		},
	};
}

export type PermissionDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<PermissionModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'delete.title',
			'restore.title',
		] as const,
		'permission.action',
	);

	return {
		dataTable: {
			state: {
				first: 0,
				rows: 10,
				sortField: 'id',
				sortOrder: -1 as const,
				filters: {
					global: { value: null, matchMode: 'contains' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies PermissionDataTableFiltersType,
			},
			columns: [
				{
					field: 'id',
					header: 'ID',
					defaultWidth: 88,
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							markDeleted: true,
						}),
				},
				{
					field: 'entity',
					header: 'Entity',
					sortable: true,
				},
				{
					field: 'operation',
					header: 'Operation',
					sortable: true,
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<PermissionModel>('permission', params),
		},
		displayEntryLabel: (entry: PermissionModel) => {
			return `${entry.entity}.${entry.operation}`;
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManagePermission,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['permission', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: PermissionFormValuesType) =>
					requestCreate<PermissionModel, PermissionFormValuesType>(
						'permission',
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
				windowComponent: FormManagePermission,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['permission', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: PermissionModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: PermissionFormValuesType,
					id: number,
				) =>
					requestUpdate<PermissionModel, PermissionFormValuesType>(
						'permission',
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
				permission: ['permission', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: PermissionModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: PermissionModel) =>
					requestDelete('permission', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['permission', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: PermissionModel) =>
					!!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: PermissionModel) =>
					requestRestore('permission', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
		},
	};
}
