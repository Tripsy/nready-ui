import { z } from 'zod';
import {
	type AddressFormValuesType,
	FormManageAddress,
} from '@/app/(public)/_components/address/form-manage-address.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { requestCreate } from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import type { AddressModel } from '@/models/address.model';
import { getPlaceContentProp } from '@/models/place.model';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_city_id',
	'invalid_city',
	'invalid_details',
	'invalid_postal_code',
	'invalid_notes',
] as const;

class AddressValidator extends BaseValidator<typeof validatorMessages> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
				city_id: this.validateId(this.getMessage('invalid_city_id'), {
					required: false, // Further check is done in superRefine
				}),
				city: this.validateString(this.getMessage('invalid_city'), {
					required: false,
				}),
				details: this.validateString(
					this.getMessage('invalid_details'),
				),
				postal_code: this.validatePostalCode(
					this.getMessage('invalid_postal_code'),
					{
						required: false,
					},
				),
				notes: this.validateString(this.getMessage('invalid_notes'), {
					required: false,
				}),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.city && !data.city_id) {
					ctx.addIssue({
						path: ['city'],
						message: this.getMessage('invalid_city_id'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: AddressFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'address.validation',
	);

	const validator = new AddressValidator(translations);

	return validator.manage(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): AddressFormValuesType {
	return {
		city_id: getFormDataAsNumber(formData, 'city_id'),
		city: getFormDataAsString(formData, 'city'),
		details: getFormDataAsString(formData, 'details'),
		postal_code: getFormDataAsString(formData, 'postal_code'),
	};
}

function getFormState(
	data?: AddressModel,
): FormStateType<AddressFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			city_id: data?.city?.id ?? null,
			city: data?.city
				? getPlaceContentProp(data?.city, getLanguageClient())
				: null,
			details: data?.details ?? null,
			postal_code: data?.postal_code ?? null,
		},
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<AddressModel>
> {
	const translations = await translateBatch(
		['create.title'] as const,
		'address.action',
	);

	return {
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageAddress,
				permission: ['address', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: AddressFormValuesType) =>
					requestCreate<AddressModel, AddressFormValuesType>(
						'address',
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
		},
	};
}
