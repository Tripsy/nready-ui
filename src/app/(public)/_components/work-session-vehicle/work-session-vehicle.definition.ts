import { z } from 'zod';
import {
	FormManageWorkSessionVehicle,
	type WorkSessionVehicleFormValuesType,
} from '@/app/(public)/_components/work-session-vehicle/form-manage-work-session-vehicle.component';
import {
	FormReturnWorkSessionVehicle,
	type WorkSessionVehicleFormReturnValuesType,
} from '@/app/(public)/_components/work-session-vehicle/form-return-work-session-vehicle.component';
import { translateBatch } from '@/config/translate.setup';
import { ExecutionError } from '@/exceptions/execution.error';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { displayCompanyVehicleLabel } from '@/models/company-vehicle.model';
import { VehicleTypeEnum } from '@/models/vehicle.model';
import {
	displayWorkSessionVehicleLabel,
	type WorkSessionVehicleModel,
} from '@/models/work-session-vehicle.model';
import { deleteWorkSessionVehicle } from '@/services/work-session-vehicle.service';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_company_vehicle_id',
	'invalid_company_vehicle',
	'invalid_vehicle_km_start',
	'invalid_vehicle_km_end',
	'invalid_vehicle_type',
	'invalid_notes',
] as const;

class WorkSessionVehicleValidator extends BaseValidator<
	typeof validatorMessages
> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
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

	return = () =>
		z
			.object({
				vehicle_type: this.validateEnum(
					VehicleTypeEnum,
					this.getMessage('invalid_vehicle_type'),
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
					data.vehicle_type &&
					data.vehicle_type !== VehicleTypeEnum.TRAILER &&
					!data.vehicle_km_end
				) {
					ctx.addIssue({
						path: ['vehicle_km_end'],
						message: this.getMessage('invalid_vehicle_km_end'),
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

async function validateReturnForm(
	values: WorkSessionVehicleFormReturnValuesType,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'work-session-vehicle',
	);

	const validator = new WorkSessionVehicleValidator(translations);

	return validator.return().safeParse(values);
}

function getFormReturnValues(
	formData: FormData,
): WorkSessionVehicleFormReturnValuesType {
	return {
		vehicle_type: getFormDataAsEnum(
			formData,
			'vehicle_type',
			VehicleTypeEnum,
		),
		vehicle_km_end: getFormDataAsNumber(formData, 'vehicle_km_end'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormReturnState(
	data?: WorkSessionVehicleModel,
): FormStateType<WorkSessionVehicleFormReturnValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			vehicle_type: data?.company_vehicle.vehicle.vehicle_type ?? null,
			vehicle_km_end: data?.vehicle_km_end ?? null,
			notes: data?.notes ?? null,
		},
	};
}
export default async function dataSourceConfig(): Promise<
	Omit<DataSourceConfigType<WorkSessionVehicleModel>, 'dataTable'>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'delete.title',
			'return.title',
		] as const,
		'work-session-vehicle.action',
	);

	return {
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
				operationFunction: () => {
					// It is overridden in the component
					throw new ExecutionError('Not defined here');
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
				operationFunction: () => {
					// It is overridden in the component
					throw new ExecutionError('Not defined here');
				},
				buttonPosition: 'hidden',
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
				windowType: 'form',
				windowTitle: translations['return.title'],
				windowComponent: FormReturnWorkSessionVehicle,
				permission: ['work-session-vehicle', 'update'],
				entriesSelection: 'single',
				operationFunction: () => {
					// It is overridden in the component
					throw new ExecutionError('Not defined here');
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormReturnValues,
				validateForm: validateReturnForm,
				getFormState: getFormReturnState,
			},
		},
	};
}
