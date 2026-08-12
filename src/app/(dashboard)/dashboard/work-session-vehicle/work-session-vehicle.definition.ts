import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageWorkSessionVehicle,
	type WorkSessionVehicleFormValuesType,
} from '@/app/(dashboard)/dashboard/work-session-vehicle/form-manage-work-session-vehicle.component';
import { ViewWorkSessionVehicle } from '@/app/(dashboard)/dashboard/work-session-vehicle/view-work-session-vehicle.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import { displayCompanyVehicleLabel } from '@/models/company-vehicle.model';
import { VehicleTypeEnum } from '@/models/vehicle.model';
import {
	displayWorkSessionLabel,
	type WorkSessionModel,
	type WorkSessionStatus,
} from '@/models/work-session.model';
import {
	displayWorkSessionVehicleLabel,
	type WorkSessionVehicleModel,
	type WorkSessionVehicleStatus,
	WorkSessionVehicleStatusEnum,
} from '@/models/work-session-vehicle.model';
import {
	createWorkSessionVehicle,
	deleteWorkSessionVehicle,
	updateStatusWorkSessionVehicle,
	updateWorkSessionVehicle,
} from '@/services/work-session-vehicle.service';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_work_session_id',
	'invalid_company_vehicle_id',
	'invalid_company_vehicle',
	'invalid_vehicle_type',
	'invalid_vehicle_km_start',
	'invalid_vehicle_km_end',
	'invalid_notes',
] as const;

class WorkSessionVehicleValidator extends BaseValidator<
	typeof validatorMessages
> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
				work_session_id: this.validateId(
					this.getMessage('invalid_work_session_id'),
				),
				company_vehicle_id: this.validateId(
					this.getMessage('invalid_company_vehicle_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				company_vehicle: this.validateString(
					this.getMessage('invalid_company_vehicle'),
				),
				vehicle_type: this.validateEnum(
					VehicleTypeEnum,
					this.getMessage('invalid_vehicle_type'),
					{
						required: false,
					},
				),
				vehicle_km_start: this.validateNumber(
					{
						invalid: this.getMessage('invalid_vehicle_km_start'),
						only_positive: this.getMessage('only_positive'),
					},
					{
						required: false,
					},
				),
				vehicle_km_end: this.validateNumber(
					{
						invalid: this.getMessage('invalid_vehicle_km_end'),
						only_positive: this.getMessage('only_positive'),
					},
					{
						required: false,
					},
				),
				notes: this.validateString(this.getMessage('invalid_notes'), {
					required: false,
				}),
			})
			.superRefine((data, ctx) => {
				if (
					isSubmit &&
					data.company_vehicle &&
					!data.company_vehicle_id
				) {
					ctx.addIssue({
						path: ['company_vehicle'],
						message: this.getMessage('invalid_company_vehicle_id'),
						code: 'custom',
					});
				}

				if (
					data.vehicle_type &&
					data.vehicle_type !== VehicleTypeEnum.TRAILER &&
					!data.vehicle_km_start
				) {
					ctx.addIssue({
						path: ['vehicle_km_start'],
						message: this.getMessage('invalid_vehicle_km_start'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: WorkSessionVehicleFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'work-session-vehicle',
	);

	const validator = new WorkSessionVehicleValidator(translations);

	return validator.manage(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): WorkSessionVehicleFormValuesType {
	return {
		work_session_id: getFormDataAsNumber(formData, 'work_session_id'),
		company_vehicle_id: getFormDataAsNumber(formData, 'company_vehicle_id'),
		company_vehicle: getFormDataAsString(formData, 'company_vehicle'),
		vehicle_type: getFormDataAsEnum(
			formData,
			'vehicle_type',
			VehicleTypeEnum,
		),
		vehicle_km_start: getFormDataAsNumber(formData, 'vehicle_km_start'),
		vehicle_km_end: getFormDataAsNumber(formData, 'vehicle_km_end'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: WorkSessionVehicleModel,
): FormStateType<WorkSessionVehicleFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			work_session_id: data?.work_session?.id ?? null,
			company_vehicle_id: data?.company_vehicle?.id ?? null,
			company_vehicle: data?.company_vehicle
				? displayCompanyVehicleLabel(data.company_vehicle)
				: null,
			vehicle_type: data?.company_vehicle.vehicle.vehicle_type ?? null,
			vehicle_km_start: data?.vehicle_km_start ?? null,
			vehicle_km_end: data?.vehicle_km_end ?? null,
			notes: data?.notes ?? null,
		},
	};
}

export type WorkSessionVehicleDataTableFiltersType = {
	company_vehicle: { value: string | null; matchMode: 'equals' };
	company_vehicle_id: { value: number | null; matchMode: 'equals' };
	work_session_status: {
		value: WorkSessionStatus | null;
		matchMode: 'equals';
	};
	status: { value: WorkSessionVehicleStatus | null; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<WorkSessionVehicleModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'delete.title',
			'view.title',
			'return.title',
		] as const,
		'work-session-vehicle.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<WorkSessionVehicleModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'work-session-vehicle', 'read')
					? 'view'
					: undefined,
			dataSource: 'work-session-vehicle',
		};
	}

	function displayButtonReturn(
		auth: AuthModel | null,
		entry: WorkSessionVehicleModel,
	): DataTableValueOptionsType<WorkSessionVehicleModel>['displayButton'] {
		return {
			action: () =>
				entry.status === WorkSessionVehicleStatusEnum.ASSIGNED &&
				hasPermission(auth, 'work-session-vehicle', 'update')
					? 'return'
					: undefined,
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
					company_vehicle: { value: '', matchMode: 'equals' },
					company_vehicle_id: { value: null, matchMode: 'equals' },
					work_session_status: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
				} satisfies WorkSessionVehicleDataTableFiltersType,
			},
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
					field: 'work_session_id',
					header: 'Session ID',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: entry.work_session.id.toString(),
						}),
				},
				{
					field: 'work_session',
					header: 'Session',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayWorkSessionLabel(
								entry.work_session,
							),
						}),
				},
				{
					field: 'work_session_status',
					header: 'Session Status',
					body: (entry) =>
						DataTableValue<WorkSessionModel>(
							entry.work_session,
							'status',
							{
								dataSource: 'work-session',
								isStatus: true,
							},
						),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'company_vehicle',
					header: 'Vehicle',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayCompanyVehicleLabel(
								entry.company_vehicle,
							),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'work-session-vehicle',
							isStatus: true,
							markDeleted: true,
							displayButton: displayButtonReturn(auth, entry),
						}),
					minWidth: 128,
					maxWidth: 128,
				},
				{
					field: 'assigned_at',
					header: 'Assigned At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
				{
					field: 'returned_at',
					header: 'Returned At',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							displayDate: true,
						}),
				},
			],
			find: (params: FindFunctionParamsType) =>
				requestFind<WorkSessionVehicleModel>(
					'work-session-vehicle',
					params,
				),
		},
		displayEntryLabel: (entry: WorkSessionVehicleModel) => {
			return displayWorkSessionVehicleLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageWorkSessionVehicle,
				permission: ['work-session-vehicle', 'create'],
				entriesSelection: 'free',
				operationFunction: (
					params: WorkSessionVehicleFormValuesType,
				) => {
					const {
						work_session_id,
						company_vehicle,
						...prepareParams
					} = params;

					return createWorkSessionVehicle(
						prepareParams,
						work_session_id,
					);
				},
				buttonPosition: 'hidden',
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageWorkSessionVehicle,
				permission: ['work-session-vehicle', 'update'],
				entriesSelection: 'single',
				operationFunction: (
					params: WorkSessionVehicleFormValuesType,
					id: number,
				) => {
					const {
						work_session_id,
						company_vehicle,
						...prepareParams
					} = params;

					return updateWorkSessionVehicle(
						prepareParams,
						id,
						work_session_id,
					);
				},
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
				permission: ['work-session-vehicle', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: WorkSessionVehicleModel) => {
					return deleteWorkSessionVehicle(entry);
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			return: {
				windowType: 'action',
				windowTitle: translations['return.title'],
				permission: ['work-session-vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: WorkSessionVehicleModel) =>
					entry.status === WorkSessionVehicleStatusEnum.ASSIGNED,
				operationFunction: (entry: WorkSessionVehicleModel) =>
					updateStatusWorkSessionVehicle(entry, 'returned'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewWorkSessionVehicle,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['work-session-vehicle', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
