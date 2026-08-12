import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type CompanyVehicleFormValuesType,
	FormManageCompanyVehicle,
} from '@/app/(dashboard)/dashboard/company-vehicle/form-manage-company-vehicle.component';
import { StatusTransitionCompanyVehicle } from '@/app/(dashboard)/dashboard/company-vehicle/status-transition-company-vehicle.component';
import { ViewCompanyVehicle } from '@/app/(dashboard)/dashboard/company-vehicle/view-company-vehicle.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	requestCreate,
	requestDelete,
	requestFind,
	requestRestore,
	requestUpdate,
} from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type CompanyVehicleModel,
	type CompanyVehicleScope,
	CompanyVehicleScopeEnum,
	type CompanyVehicleStatus,
	displayCompanyVehicleLabel,
	STATUS_TRANSITIONS,
} from '@/models/company-vehicle.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_vehicle_id',
	'invalid_vehicle',
	'invalid_scope',
	'invalid_license_plate',
	'invalid_vin',
	'invalid_notes',
] as const;

class CompanyVehicleValidator extends BaseValidator<typeof validatorMessages> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
				vehicle_id: this.validateId(
					this.getMessage('invalid_vehicle_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				vehicle: this.validateString(
					this.getMessage('invalid_vehicle'),
				),
				scope: this.validateEnum(
					CompanyVehicleScopeEnum,
					this.getMessage('invalid_scope'),
				),
				license_plate: this.validateString(
					this.getMessage('invalid_license_plate'),
					{
						required: true,
						minChars: 8,
					},
				),
				vin: this.validateString(this.getMessage('invalid_vin'), {
					required: false,
					minChars: 17,
					maxChars: 17,
				}),
				notes: this.validateString(this.getMessage('invalid_notes'), {
					required: false,
				}),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.vehicle && !data.vehicle_id) {
					ctx.addIssue({
						path: ['vehicle'],
						message: this.getMessage('invalid_vehicle_id'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: CompanyVehicleFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'company-vehicle.validation',
	);

	const validator = new CompanyVehicleValidator(translations);

	return validator.manage(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): CompanyVehicleFormValuesType {
	return {
		vehicle_id: getFormDataAsNumber(formData, 'vehicle_id'),
		vehicle: getFormDataAsString(formData, 'vehicle'),
		scope:
			getFormDataAsEnum(formData, 'scope', CompanyVehicleScopeEnum) ||
			CompanyVehicleScopeEnum.OPERATIONAL,
		vin: getFormDataAsString(formData, 'vin'),
		license_plate: getFormDataAsString(formData, 'license_plate'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: CompanyVehicleModel,
): FormStateType<CompanyVehicleFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			vehicle_id: data?.vehicle?.id ?? null,
			vehicle: data?.vehicle ? data?.vehicle?.model : null,
			scope: data?.scope ?? CompanyVehicleScopeEnum.OPERATIONAL,
			vin: data?.vin ?? null,
			license_plate: data?.license_plate ?? null,
			notes: data?.notes ?? null,
		},
	};
}

export type CompanyVehicleDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	scope: { value: CompanyVehicleScope | null; matchMode: 'equals' };
	status: { value: CompanyVehicleStatus | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CompanyVehicleModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'view.title',
			'delete.title',
			'restore.title',
			'statusTransition.title',
		] as const,
		'company-vehicle.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<CompanyVehicleModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'company-vehicle', 'read')
					? 'view'
					: undefined,
			dataSource: 'company-vehicle',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<CompanyVehicleModel>['displayButton'] {
		return {
			action: (entry: CompanyVehicleModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'company-vehicle', 'delete')
						? 'restore'
						: undefined;
				}

				const statusTransitions = getStatusTransitions(
					entry.status,
					STATUS_TRANSITIONS,
				);

				if (statusTransitions.length === 0) {
					return undefined;
				}

				if (!hasPermission(auth, 'company-vehicle', 'update')) {
					return undefined;
				}

				return 'statusTransition';
			},
			dataSource: 'company-vehicle',
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
					scope: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies CompanyVehicleDataTableFiltersType,
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
					field: 'brand',
					header: 'Brand',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.vehicle.brand?.name || 'n/a',
						}),
				},
				{
					field: 'model',
					header: 'Model',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.vehicle.model,
						}),
				},
				{
					field: 'vehicle_type',
					header: 'Type',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(
								entry.vehicle.vehicle_type,
							),
						}),
				},
				{
					field: 'license_plate',
					header: 'License Plate',
				},
				{
					field: 'scope',
					header: 'Scope',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: formatEnumLabel(entry.scope),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'company-vehicle',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonStatus(auth),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<CompanyVehicleModel>('company-vehicle', params),
		},
		displayEntryLabel: (entry: CompanyVehicleModel) => {
			return displayCompanyVehicleLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCompanyVehicle,
				permission: ['company-vehicle', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: CompanyVehicleFormValuesType) =>
					requestCreate<
						CompanyVehicleModel,
						CompanyVehicleFormValuesType
					>('company-vehicle', params),
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
				windowComponent: FormManageCompanyVehicle,
				permission: ['company-vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CompanyVehicleModel) =>
					!entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (
					params: CompanyVehicleFormValuesType,
					id: number,
				) =>
					requestUpdate<
						CompanyVehicleModel,
						CompanyVehicleFormValuesType
					>('company-vehicle', params, id),
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
				permission: ['company-vehicle', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CompanyVehicleModel) =>
					!entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: CompanyVehicleModel) =>
					requestDelete('company-vehicle', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['company-vehicle', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CompanyVehicleModel) =>
					!!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: CompanyVehicleModel) =>
					requestRestore('company-vehicle', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewCompanyVehicle,
				windowConfigProps: {
					size: 'xl',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['company-vehicle', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionCompanyVehicle,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['company-vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CompanyVehicleModel) =>
					!entry.deleted_at &&
					getStatusTransitions(entry.status, STATUS_TRANSITIONS)
						.length > 0,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
		},
	};
}
