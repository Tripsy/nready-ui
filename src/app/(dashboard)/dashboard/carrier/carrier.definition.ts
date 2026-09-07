import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type CarrierFormValuesType,
	FormManageCarrier,
} from '@/app/(dashboard)/dashboard/carrier/form-manage-carrier.component';
import { UsageGuideCarrier } from '@/app/(dashboard)/dashboard/carrier/usage-guide-carrier.component';
import { ViewCarrier } from '@/app/(dashboard)/dashboard/carrier/view-carrier.component';
import { Icons } from '@/components/icon.component';
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
import { type AccountModel, hasPermission } from '@/models/account.model';
import { type CarrierModel, displayCarrierLabel } from '@/models/carrier.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_name',
	'invalid_website',
	'invalid_phone',
	'invalid_email',
	'invalid_notes',
] as const;

class CarrierValidator extends BaseValidator<typeof validatorMessages> {
	manage = () =>
		z.object({
			name: this.validateString(this.getMessage('invalid_name')),
			website: this.validateString(this.getMessage('invalid_website'), {
				required: false,
			}),
			phone: this.validatePhone(this.getMessage('invalid_phone'), {
				required: false,
			}),
			email: this.validateEmail(this.getMessage('invalid_email'), {
				required: false,
			}),
			notes: this.validateString(this.getMessage('invalid_notes'), {
				required: false,
			}),
		});
}

async function validateForm(values: CarrierFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'carrier.validation',
	);

	const validator = new CarrierValidator(translations);

	return validator.manage().safeParse(values);
}

function getFormValues(formData: FormData): CarrierFormValuesType {
	return {
		name: getFormDataAsString(formData, 'name'),
		website: getFormDataAsString(formData, 'website'),
		phone: getFormDataAsString(formData, 'phone'),
		email: getFormDataAsString(formData, 'email'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: CarrierModel,
): FormStateType<CarrierFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			name: data?.name ?? null,
			website: data?.website ?? null,
			phone: data?.phone ?? null,
			email: data?.email ?? null,
			notes: data?.notes ?? null,
		},
	};
}

export type CarrierDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CarrierModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'guide.title',
		] as const,
		'carrier.action',
	);

	function displayButtonView(
		auth: AccountModel | null,
	): DataTableValueOptionsType<CarrierModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'carrier', 'read') ? 'view' : undefined,
			dataSource: 'carrier',
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
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies CarrierDataTableFiltersType,
			},
			// Only `id`, `name`, `created_at` and `updated_at` are sortable - they are the
			// columns the backend's `OrderByEnum` accepts.
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
					field: 'name',
					header: 'Name',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							markDeleted: true,
						}),
				},
				{
					field: 'website',
					header: 'Website',
				},
				{
					field: 'phone',
					header: 'Phone',
				},
				{
					field: 'email',
					header: 'Email',
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
				requestFind<CarrierModel>('carrier', params),
		},
		displayEntryLabel: (entry: CarrierModel) => displayCarrierLabel(entry),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCarrier,
				permission: ['carrier', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: CarrierFormValuesType) =>
					requestCreate<CarrierModel, CarrierFormValuesType>(
						'carrier',
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
				windowComponent: FormManageCarrier,
				permission: ['carrier', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CarrierModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: CarrierFormValuesType,
					id: number,
				) =>
					requestUpdate<CarrierModel, CarrierFormValuesType>(
						'carrier',
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
				permission: ['carrier', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CarrierModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: CarrierModel) =>
					requestDelete('carrier', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['carrier', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CarrierModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: CarrierModel) =>
					requestRestore('carrier', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCarrier,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['carrier', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			guide: {
				windowType: 'other',
				windowTitle: translations['guide.title'],
				windowComponent: UsageGuideCarrier,
				windowConfigProps: {
					size: 'xl2',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['carrier', 'read'],
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
