import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	type ClientFormValuesType,
	FormManageClient,
} from '@/app/(dashboard)/dashboard/client/form-manage-client.component';
import { ViewClient } from '@/app/(dashboard)/dashboard/client/view-client.component';
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
	type ClientModel,
	type ClientStatus,
	ClientStatusEnum,
	type ClientType,
	ClientTypeEnum,
	displayClientLabel,
} from '@/models/client.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	'invalid_client_type',
	'invalid_iban',
	'invalid_bank_name',
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
		iban: this.validateIBAN(this.getMessage('invalid_iban'), {
			required: false,
		}),
		bank_name: this.validateString(this.getMessage('invalid_bank_name'), {
			required: false,
		}),
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

		iban: getFormDataAsString(formData, 'iban'),
		bank_name: getFormDataAsString(formData, 'bank_name'),

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

			iban: data?.iban ?? null,
			bank_name: data?.bank_name ?? null,

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

export type ClientDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	status: { value: ClientStatus | null; matchMode: 'equals' };
	client_type: { value: ClientType | null; matchMode: 'equals' };
	create_at_start: { value: string | null; matchMode: 'equals' };
	create_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<ClientModel>
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
		'client.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ClientModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'client', 'read') ? 'view' : undefined,
			dataSource: 'client',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<ClientModel>['displayButton'] {
		return {
			action: (entry: ClientModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'client', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'client', 'update')) {
					return undefined;
				}

				return entry.status === ClientStatusEnum.ACTIVE
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
					status: { value: null, matchMode: 'equals' },
					client_type: { value: null, matchMode: 'equals' },
					create_at_start: { value: null, matchMode: 'equals' },
					create_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies ClientDataTableFiltersType,
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
					field: 'client_type',
					header: 'Type',
					sortable: true,
					body: (entry, column) =>
						DataTableValue(entry, column, {
							capitalize: true,
						}),
				},
				{
					field: 'name',
					header: 'Name',
					body: (entry, column) =>
						DataTableValue(entry, column, {
							customValue: displayClientLabel(entry),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'client',
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
				requestFind<ClientModel>('client', params),
		},
		displayEntryLabel: (entry: ClientModel) => {
			return displayClientLabel(entry);
		},
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
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageClient,
				windowConfigProps: {
					size: 'x2l',
				},
				permission: ['client', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ClientModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: ClientFormValuesType, id: number) =>
					requestUpdate<ClientModel, ClientFormValuesType>(
						'client',
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
				permission: ['client', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ClientModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: ClientModel) =>
					requestDelete('client', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['client', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ClientModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: ClientModel) =>
					requestRestore('client', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['client', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ClientModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [
						ClientStatusEnum.PENDING,
						ClientStatusEnum.INACTIVE,
					]),
				operationFunction: (entry: ClientModel) =>
					requestUpdateStatus('client', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['client', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: ClientModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [
						ClientStatusEnum.PENDING,
						ClientStatusEnum.ACTIVE,
					]),
				operationFunction: (entry: ClientModel) =>
					requestUpdateStatus('client', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewClient,
				windowConfigProps: {
					size: 'x4l',
					closeOnBackdrop: true,
					closeOnEscape: true,
				},
				permission: ['client', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
		},
	};
}
