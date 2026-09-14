import { z } from 'zod';
import {
	type ClientAddressFormValuesType,
	FormManageClientAddress,
} from '@/app/(dashboard)/dashboard/client-address/form-manage-client-address.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	requestCreate,
	requestDelete,
	requestUpdate,
} from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { displayAddressLabel } from '@/models/address.model';
import {
	type ClientAddressModel,
	ClientAddressTypeEnum,
	displayClientAddressLabel,
} from '@/models/client-address.model';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_client_id',
	'invalid_address_id',
	'invalid_address',
	'invalid_type',
	'invalid_details',
	'invalid_notes',
] as const;

class ClientAddressValidator extends BaseValidator<typeof validatorMessages> {
	manage = z.object({
		client_id: this.validateId(this.getMessage('invalid_client_id')),
		// Only a picked (or newly created) address sets the id - typing clears it
		address_id: this.validateId(this.getMessage('invalid_address_id')),
		address: this.validateString(this.getMessage('invalid_address'), {
			required: false,
		}),
		type: this.validateEnum(
			ClientAddressTypeEnum,
			this.getMessage('invalid_type'),
		),
		details: this.validateString(this.getMessage('invalid_details'), {
			required: false,
		}),
		notes: this.validateString(this.getMessage('invalid_notes'), {
			required: false,
		}),
	});
}

async function validateForm(values: ClientAddressFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'client-address.validation',
	);

	const validator = new ClientAddressValidator(translations);

	return validator.manage.safeParse(values);
}

function getFormValues(formData: FormData): ClientAddressFormValuesType {
	return {
		client_id: getFormDataAsNumber(formData, 'client_id'),
		address_id: getFormDataAsNumber(formData, 'address_id'),
		address: getFormDataAsString(formData, 'address'),
		type:
			getFormDataAsEnum(formData, 'type', ClientAddressTypeEnum) ??
			ClientAddressTypeEnum.BILLING,
		details: getFormDataAsString(formData, 'details'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

/**
 * Seeds both windows. Create receives the prefill the client's address manager passes - the
 * client and the section (type) the button sat in - and update the listed entry, which already
 * carries its address and city joined.
 */
function getFormState(
	data?: Partial<ClientAddressModel>,
): FormStateType<ClientAddressFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			client_id: data?.client_id ?? null,
			address_id: data?.address_id ?? null,
			address: data?.address
				? displayAddressLabel(data.address, getLanguageClient())
				: null,
			type: data?.type ?? ClientAddressTypeEnum.BILLING,
			details: data?.details ?? null,
			notes: data?.notes ?? null,
		},
	};
}

/** Strips the address's display text, which the API has no field for. */
function prepareUpdateParams(data: ClientAddressFormValuesType) {
	return {
		type: data.type,
		address_id: data.address_id,
		details: data.details,
		notes: data.notes,
	};
}

/** The client is fixed once created - the backend `update` takes no `client_id`. */
function prepareCreateParams(data: ClientAddressFormValuesType) {
	return {
		client_id: data.client_id,
		...prepareUpdateParams(data),
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ClientAddressModel>
> {
	const translations = await translateBatch(
		['create.title', 'update.title', 'delete.title'] as const,
		'client-address.action',
	);

	return {
		/*
		 * No `dataTable`: this data source has no page of its own. A client address is only ever
		 * read in the context of its client, which `ManagerAddressesClient` lists directly - the
		 * registry is here for the create/update/delete windows the manager opens.
		 */
		displayEntryLabel: (entry: ClientAddressModel) =>
			displayClientAddressLabel(entry, getLanguageClient()),
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageClientAddress,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['client-address', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: ClientAddressFormValuesType) => {
					const params = prepareCreateParams(values);

					return requestCreate<ClientAddressModel, typeof params>(
						'client-address',
						params,
					);
				},
				/*
				 * A client or an address removed meanwhile answers 404 with the reason in the
				 * message, which `processForm` otherwise passes through only for a 409.
				 */
				mapApiError: async (error) =>
					error.status === 404 ? { message: error.message } : {},
				buttonPosition: 'hidden',
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageClientAddress,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['client-address', 'update'],
				entriesSelection: 'single',
				operationFunction: (
					values: ClientAddressFormValuesType,
					id: number,
				) => {
					const params = prepareUpdateParams(values);

					return requestUpdate<ClientAddressModel, typeof params>(
						'client-address',
						params,
						id,
					);
				},
				mapApiError: async (error) =>
					error.status === 404 ? { message: error.message } : {},
				buttonPosition: 'hidden',
				getFormValues: getFormValues,
				validateForm: validateForm,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['client-address', 'delete'],
				entriesSelection: 'single',
				operationFunction: (entry: ClientAddressModel) =>
					requestDelete('client-address', entry),
				buttonPosition: 'hidden',
			},
		},
	};
}
