import { z } from 'zod';
import {
	type ClientFormValuesType,
	FormManageClient,
} from '@/app/(public)/_components/client/form-manage-client.component';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsEnum, getFormDataAsString } from '@/helpers/form.helper';
import { requestCreate } from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { type ClientModel, ClientTypeEnum } from '@/models/client.model';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_client_type',
	'invalid_contact_name',
	'invalid_contact_email',
	'invalid_contact_phone',
	'invalid_notes',
	'invalid_company_name',
	'invalid_company_cui',
	'invalid_company_reg_com',
	'invalid_person_name',
	'invalid_person_identification_number',
] as const;

class ClientValidator extends BaseValidator<typeof validatorMessages> {
	baseSchema = {
		contact_name: this.validateString(
			this.getMessage('invalid_contact_name'),
			{
				required: false,
			},
		),
		contact_email: this.validateEmail(
			this.getMessage('invalid_contact_email'),
			{
				required: false,
			},
		),
		contact_phone: this.validatePhone(
			this.getMessage('invalid_contact_phone'),
			{
				required: false,
			},
		),
		notes: this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		}),
	};

	manage = z.discriminatedUnion('client_type', [
		// Company schema
		z
			.object({
				client_type: z.literal(ClientTypeEnum.COMPANY),
				company_name: this.validateString(
					this.getMessage('invalid_company_name'),
				),
				company_cui: this.validateString(
					this.getMessage('invalid_company_cui'),
				),
				company_reg_com: this.validateString(
					this.getMessage('invalid_company_reg_com'),
					{
						required: false,
					},
				),
				person_name: z.never().optional(),
				person_identification_number: z.never().optional(),
			})
			.extend(this.baseSchema),

		// Person schema
		z
			.object({
				client_type: z.literal(ClientTypeEnum.PERSON),
				company_name: z.never().optional(),
				company_cui: z.never().optional(),
				company_reg_com: z.never().optional(),
				person_name: this.validateString(
					this.getMessage('invalid_person_name'),
				),
				person_identification_number:
					this.validatePersonalIdentificationNumber(
						this.getMessage('invalid_person_identification_number'),
						{
							required: false,
						},
					),
			})
			.extend(this.baseSchema),
	]);
}

async function validateForm(values: ClientFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'client.validation',
	);

	const validator = new ClientValidator(translations);

	return validator.manage.safeParse(values);
}

export function getFormValues(formData: FormData): ClientFormValuesType {
	const client_type =
		getFormDataAsEnum(formData, 'client_type', ClientTypeEnum) ||
		ClientTypeEnum.COMPANY;

	const base = {
		notes: getFormDataAsString(formData, 'notes'),

		contact_name: getFormDataAsString(formData, 'contact_name'),
		contact_email: getFormDataAsString(formData, 'contact_email'),
		contact_phone: getFormDataAsString(formData, 'contact_phone'),
	};

	if (client_type === ClientTypeEnum.COMPANY) {
		return {
			...base,
			client_type: ClientTypeEnum.COMPANY,

			company_name: getFormDataAsString(formData, 'company_name'),
			company_cui: getFormDataAsString(formData, 'company_cui'),
			company_reg_com: getFormDataAsString(formData, 'company_reg_com'),
		};
	}

	return {
		...base,
		client_type: ClientTypeEnum.PERSON,

		person_name: getFormDataAsString(formData, 'person_name'),
		person_identification_number: getFormDataAsString(
			formData,
			'person_identification_number',
		),
	};
}

function getFormState(data?: ClientModel): FormStateType<ClientFormValuesType> {
	const client_type = data?.client_type ?? ClientTypeEnum.COMPANY;

	const state = {
		errors: {},
		message: null,
		situation: null,
		values: {
			client_type: client_type,

			contact_name: data?.contact_name ?? null,
			contact_email: data?.contact_email ?? null,
			contact_phone: data?.contact_phone ?? null,

			notes: data?.notes ?? null,
		},
	};

	if (client_type === ClientTypeEnum.COMPANY) {
		return {
			...state,
			values: {
				...state.values,
				company_name: data?.company_name ?? null,
				company_cui: data?.company_cui ?? null,
				company_reg_com: data?.company_reg_com ?? null,
			},
		};
	}

	return {
		...state,
		values: {
			...state.values,
			person_name: data?.person_name ?? null,
			person_identification_number:
				data?.person_identification_number ?? null,
		},
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ClientModel>
> {
	const translations = await translateBatch(
		['create.title'] as const,
		'client.action',
	);

	return {
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageClient,
				windowConfigProps: {
					size: 'x2l',
				},
				permission: ['client', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: ClientFormValuesType) =>
					requestCreate<ClientModel, ClientFormValuesType>(
						'client',
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
