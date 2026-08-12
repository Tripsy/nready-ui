import { z } from 'zod';
import {
	type CmrFormValuesType,
	FormManageCmr,
} from '@/app/(public)/_components/cmr/form-manage-cmr.component';
import { ManagerCmrImages } from '@/app/(public)/_components/cmr/manager-cmr-images.component';
import { SetupCmrVehicles } from '@/app/(public)/_components/cmr/setup-cmr-vehicles.component';
import { StatusTransitionCmr } from '@/app/(public)/_components/cmr/status-transition-cmr.component';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
import {
	combineDateAndTime,
	formatDate,
	stringToDate,
} from '@/helpers/date.helper';
import {
	getFormDataAsEnum,
	getFormDataAsNumber,
	getFormDataAsString,
} from '@/helpers/form.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	requestCreate,
	requestDelete,
	requestUpdate,
} from '@/helpers/services.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import { displayAddressLabel } from '@/models/address.model';
import { displayClientLabel } from '@/models/client.model';
import {
	type CmrModel,
	CmrStatusEnum,
	CmrTransportTypeEnum,
	displayCmrLabel,
	STATUS_TRANSITIONS,
} from '@/models/cmr.model';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType, ValidatorOutput } from '@/types/form.type';

const validatorMessages = [
	'invalid_transport_type',
	'invalid_client_id',
	'invalid_client',
	'invalid_pickup_address_id',
	'invalid_pickup_address',
	'invalid_delivery_address_id',
	'invalid_delivery_address',
	'invalid_contact_name',
	'invalid_contact_email',
	'invalid_contact_phone',
	'invalid_pick_scheduled_at',
	'invalid_pick_scheduled_at_time',
	'invalid_estimated_delivery_at',
	'invalid_estimated_delivery_at_time',
	'invalid_delivered_at',
	'invalid_delivered_at_time',
	'invalid_notes',
	'delivery_same_as_pickup_address',
] as const;

class CmrValidator extends BaseValidator<typeof validatorMessages> {
	manage = (isSubmit: boolean = true) =>
		z
			.object({
				transport_type: this.validateEnum(
					CmrTransportTypeEnum,
					this.getMessage('invalid_transport_type'),
				),

				client_id: this.validateId(
					this.getMessage('invalid_client_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				client: this.validateString(this.getMessage('invalid_client')),
				pickup_address_id: this.validateId(
					this.getMessage('invalid_pickup_address_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				pickup_address: this.validateString(
					this.getMessage('invalid_pickup_address'),
				),
				delivery_address_id: this.validateId(
					this.getMessage('invalid_delivery_address_id'),
					{
						required: false, // Further check is done in superRefine
					},
				),
				delivery_address: this.validateString(
					this.getMessage('invalid_delivery_address'),
				),
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
				pick_scheduled_at: this.validateDate(
					this.getMessage('invalid_pick_scheduled_at'),
					{
						required: false,
					},
				),
				pick_scheduled_at_time: this.validateTime(
					this.getMessage('invalid_pick_scheduled_at_time'),
					{
						required: false,
					},
				),
				estimated_delivery_at: this.validateDate(
					this.getMessage('invalid_estimated_delivery_at'),
					{
						required: false,
					},
				),
				estimated_delivery_at_time: this.validateTime(
					this.getMessage('invalid_estimated_delivery_at_time'),
					{
						required: false,
					},
				),
				delivered_at: this.validateDate(
					this.getMessage('invalid_delivered_at'),
					{
						required: false,
					},
				),
				delivered_at_time: this.validateTime(
					this.getMessage('invalid_delivered_at_time'),
					{
						required: false,
					},
				),
				notes: this.validateString(this.getMessage('invalid_notes'), {
					required: false,
				}),
			})
			.superRefine((data, ctx) => {
				if (isSubmit && data.client && !data.client_id) {
					ctx.addIssue({
						path: ['client'],
						message: this.getMessage('invalid_client_id'),
						code: 'custom',
					});
				}

				if (
					isSubmit &&
					data.pickup_address &&
					!data.pickup_address_id
				) {
					ctx.addIssue({
						path: ['pickup_address'],
						message: this.getMessage('invalid_pickup_address_id'),
						code: 'custom',
					});
				}

				if (
					isSubmit &&
					data.delivery_address &&
					!data.delivery_address_id
				) {
					ctx.addIssue({
						path: ['delivery_address'],
						message: this.getMessage('invalid_delivery_address_id'),
						code: 'custom',
					});
				}

				if (data.pickup_address_id === data.delivery_address_id) {
					ctx.addIssue({
						path: ['delivery_address_id'],
						message: this.getMessage(
							'delivery_same_as_pickup_address',
						),
						code: 'custom',
					});
				}

				if (data.pick_scheduled_at && !data.pick_scheduled_at_time) {
					ctx.addIssue({
						path: ['pick_scheduled_at_time'],
						message: this.getMessage(
							'invalid_pick_scheduled_at_time',
						),
						code: 'custom',
					});
				}

				if (
					data.estimated_delivery_at_time &&
					!data.estimated_delivery_at_time
				) {
					ctx.addIssue({
						path: ['estimated_delivery_at_time'],
						message: this.getMessage(
							'invalid_estimated_delivery_at_time',
						),
						code: 'custom',
					});
				}

				if (data.delivered_at && !data.delivered_at_time) {
					ctx.addIssue({
						path: ['delivered_at_time'],
						message: this.getMessage('invalid_delivered_at_time'),
						code: 'custom',
					});
				}
			});
}

async function validateForm(
	values: CmrFormValuesType,
	isSubmit: boolean = true,
) {
	const translations = await translateBatch(
		validatorMessages,
		'cmr.validation',
	);

	const validator = new CmrValidator(translations);

	return validator.manage(isSubmit).safeParse(values);
}

function getFormValues(formData: FormData): CmrFormValuesType {
	return {
		transport_type:
			getFormDataAsEnum(
				formData,
				'transport_type',
				CmrTransportTypeEnum,
			) || CmrTransportTypeEnum.DOMESTIC,
		client_id: getFormDataAsNumber(formData, 'client_id'),
		client: getFormDataAsString(formData, 'client'),
		pickup_address_id: getFormDataAsNumber(formData, 'pickup_address_id'),
		pickup_address: getFormDataAsString(formData, 'pickup_address'),
		delivery_address_id: getFormDataAsNumber(
			formData,
			'delivery_address_id',
		),
		delivery_address: getFormDataAsString(formData, 'delivery_address'),
		contact_name: getFormDataAsString(formData, 'contact_name'),
		contact_email: getFormDataAsString(formData, 'contact_email'),
		contact_phone: getFormDataAsString(formData, 'contact_phone'),
		pick_scheduled_at: getFormDataAsString(formData, 'pick_scheduled_at'),
		pick_scheduled_at_time: getFormDataAsString(
			formData,
			'pick_scheduled_at_time',
		),
		estimated_delivery_at: getFormDataAsString(
			formData,
			'estimated_delivery_at',
		),
		estimated_delivery_at_time: getFormDataAsString(
			formData,
			'estimated_delivery_at_time',
		),
		delivered_at: getFormDataAsString(formData, 'delivered_at'),
		delivered_at_time: getFormDataAsString(formData, 'delivered_at_time'),
		notes: getFormDataAsString(formData, 'notes'),
	};
}

function getFormState(data?: CmrModel): FormStateType<CmrFormValuesType> {
	const transport_type =
		data?.transport_type ?? CmrTransportTypeEnum.DOMESTIC;

	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			transport_type,
			client_id: data?.client?.id ?? null,
			client: data?.client ? displayClientLabel(data.client) : null,
			pickup_address_id: data?.pickup_address?.id ?? null,
			pickup_address: data?.pickup_address
				? displayAddressLabel(data.pickup_address, getLanguageClient())
				: null,
			delivery_address_id: data?.delivery_address?.id ?? null,
			delivery_address: data?.delivery_address
				? displayAddressLabel(
						data.delivery_address,
						getLanguageClient(),
					)
				: null,
			contact_name: data?.contact_name ?? null,
			contact_email: data?.contact_email ?? null,
			contact_phone: data?.contact_phone ?? null,
			pick_scheduled_at:
				formatDate(data?.pick_scheduled_at, 'default') ?? null,
			pick_scheduled_at_time:
				formatDate(data?.pick_scheduled_at, 'time') ?? null,
			estimated_delivery_at:
				formatDate(data?.estimated_delivery_at, 'default') ?? null,
			estimated_delivery_at_time:
				formatDate(data?.estimated_delivery_at, 'time') ?? null,
			delivered_at: formatDate(data?.delivered_at, 'default') ?? null,
			delivered_at_time: formatDate(data?.delivered_at, 'time') ?? null,
			notes: data?.notes ?? null,
		},
	};
}

type CmrManageOutput = ValidatorOutput<CmrValidator, 'manage'>;

function prepareParamsFromFormValues(data: CmrManageOutput) {
	const {
		client,
		pickup_address,
		delivery_address,
		pick_scheduled_at,
		pick_scheduled_at_time,
		estimated_delivery_at,
		estimated_delivery_at_time,
		delivered_at,
		delivered_at_time,
		...prepareParams
	} = data;

	const determinedDate = (date: string | null, time: string | null) => {
		if (date && time) {
			return combineDateAndTime(stringToDate(date), time);
		}

		return null;
	};

	return {
		...prepareParams,
		pick_scheduled_at: determinedDate(
			pick_scheduled_at,
			pick_scheduled_at_time,
		),
		estimated_delivery_at: determinedDate(
			estimated_delivery_at,
			estimated_delivery_at_time,
		),
		delivered_at: determinedDate(delivered_at, delivered_at_time),
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<CmrModel>
> {
	const translations = await translateBatch(
		[
			'create.title',
			'update.title',
			'delete.title',
			'statusTransition.title',
			'setupVehicles.title',
			'managerImages.title',
		] as const,
		'cmr.action',
	);

	return {
		displayEntryLabel: (entry: CmrModel) => {
			return displayCmrLabel(entry);
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageCmr,
				windowConfigProps: {
					size: 'x3l',
				},
				permission: ['cmr', 'create'],
				entriesSelection: 'free',
				operationFunction: (values: CmrManageOutput) => {
					const params = prepareParamsFromFormValues(values);

					return requestCreate<CmrModel, typeof params>(
						'cmr',
						params,
					);
				},
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
				windowComponent: FormManageCmr,
				windowConfigProps: {
					size: 'x3l',
				},
				permission: ['cmr', 'update'],
				entriesSelection: 'single',
				operationFunction: (values: CmrManageOutput, id: number) => {
					const params = prepareParamsFromFormValues(values);

					return requestUpdate<CmrModel, typeof params>(
						'cmr',
						params,
						id,
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
				permission: ['cmr', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CmrModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: CmrModel) =>
					requestDelete('cmr', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			statusTransition: {
				windowType: 'other',
				windowTitle: translations['statusTransition.title'],
				windowComponent: StatusTransitionCmr,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['cmr', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CmrModel) =>
					getStatusTransitions(entry.status, STATUS_TRANSITIONS)
						.length > 0,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			setupVehicles: {
				windowType: 'other',
				windowTitle: translations['setupVehicles.title'],
				windowComponent: SetupCmrVehicles,
				windowConfigProps: {
					size: 'x3l',
				},
				permission: ['cmr-vehicle', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: CmrModel) =>
					entry.status === CmrStatusEnum.PREPARING,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
					icon: 'Setup',
				},
			},
			managerImages: {
				windowType: 'other',
				windowTitle: translations['managerImages.title'],
				windowComponent: ManagerCmrImages,
				windowConfigProps: {
					size: 'x4l',
				},
				permission: ['cmr', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
					icon: 'Image',
				},
			},
		},
	};
}
