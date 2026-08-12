import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageVendor,
	type VendorFormValuesType,
} from '@/app/(dashboard)/dashboard/vendor/form-manage-vendor.component';
import { ViewVendor } from '@/app/(dashboard)/dashboard/vendor/view-vendor.component';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsEnum, getFormDataAsString } from '@/helpers/form.helper';
import { arrayHasValue } from '@/helpers/objects.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
	requestUpdateStatus,
} from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	displayVendorLabel,
	VENDOR_DEFAULT_TYPE,
	type VendorModel,
	type VendorStatus,
	VendorStatusEnum,
	type VendorType,
	VendorTypeEnum,
} from '@/models/vendor.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = ['invalid_name', 'invalid_type'] as const;

class VendorValidator extends BaseValidator<typeof validatorMessages> {
	manage = () =>
		z.object({
			name: this.validateString(this.getMessage('invalid_name')),
			type: this.validateEnum(
				VendorTypeEnum,
				this.getMessage('invalid_type'),
			),
		});
}

async function validateForm(values: VendorFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'vendor.validation',
	);

	const validator = new VendorValidator(translations);

	return validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): VendorFormValuesType {
	return {
		name: getFormDataAsString(formData, 'name'),
		type:
			getFormDataAsEnum(formData, 'type', VendorTypeEnum) ||
			VENDOR_DEFAULT_TYPE,
	};
}

function getFormState(data?: VendorModel): FormStateType<VendorFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			name: data?.name ?? null,
			type: data?.type ?? VENDOR_DEFAULT_TYPE,
		},
	};
}

export type VendorDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	type: { value: VendorType | null; matchMode: 'equals' };
	status: { value: VendorStatus | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<VendorModel>
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
		] as const,
		'vendor.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<VendorModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'vendor', 'read') ? 'view' : undefined,
			dataSource: 'vendor',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<VendorModel>['displayButton'] {
		return {
			action: (entry: VendorModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'vendor', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'vendor', 'update')) {
					return undefined;
				}

				return entry.status === VendorStatusEnum.ACTIVE
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
					type: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies VendorDataTableFiltersType,
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
					field: 'type',
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
							dataSource: 'vendor',
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
				requestFind<VendorModel>('vendor', params),
		},
		displayEntryLabel: (entry: VendorModel) => displayVendorLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageVendor,
				permission: ['vendor', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: VendorFormValuesType) =>
					requestCreate<VendorModel, VendorFormValuesType>(
						'vendor',
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
				windowComponent: FormManageVendor,
				permission: ['vendor', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VendorModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: VendorFormValuesType, id: number) =>
					requestUpdate<VendorModel, VendorFormValuesType>(
						'vendor',
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
				permission: ['vendor', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VendorModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: VendorModel) =>
					requestDelete('vendor', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['vendor', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VendorModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: VendorModel) =>
					requestRestore('vendor', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['vendor', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VendorModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [
						VendorStatusEnum.PENDING,
						VendorStatusEnum.INACTIVE,
					]),
				operationFunction: (entry: VendorModel) =>
					requestUpdateStatus('vendor', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['vendor', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: VendorModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [
						VendorStatusEnum.PENDING,
						VendorStatusEnum.ACTIVE,
					]),
				operationFunction: (entry: VendorModel) =>
					requestUpdateStatus('vendor', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewVendor,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['vendor', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
