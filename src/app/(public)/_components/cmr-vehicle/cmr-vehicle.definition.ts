import { z } from 'zod';
import {
	type CmrVehicleFormValuesType,
	FormManageCmrVehicle,
} from '@/app/(public)/_components/cmr-vehicle/form-manage-cmr-vehicle.component';
import { translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import {
	type CmrVehicleModel,
	displayCmrVehicleLabel,
} from '@/models/cmr-vehicle.model';
import { displayVehicleLabel } from '@/models/vehicle.model';
import {
	createCmrVehicle,
	deleteCmrVehicle,
	updateCmrVehicle,
} from '@/services/cmr-vehicle.service';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_cmr_id',
	'invalid_vehicle_id',
	'invalid_vehicle',
	'invalid_vin',
	'invalid_license_plate',
	'invalid_notes',
] as const;

class CmrVehicleValidator extends BaseValidator<typeof validatorMessages> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
				cmr_id: this.validateId(this.getMessage('invalid_cmr_id')),
				vehicle_id: this.validateId(
					this.getMessage('invalid_vehicle_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				vehicle: this.validateString(
					this.getMessage('invalid_vehicle'),
				),
				vin: this.validateString(this.getMessage('invalid_vin'), {
					required: true,
					minChars: 17,
					maxChars: 17,
				}),
				license_plate: this.validateString(
					this.getMessage('invalid_license_plate'),
					{
						required: false,
						minChars: 8,
					},
				),
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
	values: CmrVehicleFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'cmr-vehicle.validation',
	);

	const validator = new CmrVehicleValidator(translations);

	return validator.manage(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): CmrVehicleFormValuesType {
	return {
		cmr_id: getFormDataAsNumber(formData, 'cmr_id'),
		vehicle_id: getFormDataAsNumber(formData, 'vehicle_id'),
		vehicle: getFormDataAsString(formData, 'vehicle'),
		vin: getFormDataAsString(formData, 'vin'),
		license_plate: getFormDataAsString(formData, 'license_plate'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(
	data?: CmrVehicleModel,
): FormStateType<CmrVehicleFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			cmr_id: data?.cmr?.id ?? null,
			vehicle_id: data?.vehicle?.id ?? null,
			vehicle: data?.vehicle ? displayVehicleLabel(data.vehicle) : null,
			vin: data?.vin ?? null,
			license_plate: data?.license_plate ?? null,
			notes: data?.notes ?? null,
		},
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CmrVehicleModel>
> {
	const translations = await translateBatch(
		['create.title', 'update.title', 'delete.title'] as const,
		'cmr-vehicle.action',
	);

	return {
		displayEntryLabel: (entry: CmrVehicleModel) => {
			return displayCmrVehicleLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCmrVehicle,
				permission: ['cmr-vehicle', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: CmrVehicleFormValuesType) => {
					const { cmr_id, vehicle, ...prepareParams } = params;

					return createCmrVehicle(prepareParams, cmr_id);
				},
				buttonPosition: 'hidden',
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageCmrVehicle,
				permission: ['cmr-vehicle', 'update'],
				entriesSelection: 'single',
				operationFunction: (
					params: CmrVehicleFormValuesType,
					id: number,
				) => {
					const { cmr_id, vehicle, ...prepareParams } = params;

					return updateCmrVehicle(prepareParams, id, cmr_id);
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
				permission: ['cmr-vehicle', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: CmrVehicleModel) => {
					return deleteCmrVehicle(entry);
				},
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
		},
	};
}
