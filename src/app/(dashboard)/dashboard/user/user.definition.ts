import { z } from 'zod';
import { DataTableValue } from '@/app/(dashboard)/_components/data-table-value';
import {
	FormManageUser,
	type UserFormValuesType,
} from '@/app/(dashboard)/dashboard/user/form-manage-user.component';
import { SetupUserPermissions } from '@/app/(dashboard)/dashboard/user/setup-user-permissions.component';
import { ViewUser } from '@/app/(dashboard)/dashboard/user/view-user.component';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient, translateBatch } from '@/config/translate.setup';
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
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type AuthModel, hasPermission } from '@/models/auth.model';
import {
	type UserModel,
	UserOperatorTypeEnum,
	type UserRole,
	UserRoleEnum,
	type UserStatus,
	UserStatusEnum,
} from '@/models/user.model';
import type { FindFunctionParamsType } from '@/types/action.type';
import { LanguageEnum } from '@/types/common.type';
import type {
	DataSourceConfigType,
	DataTableValueOptionsType,
} from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_name',
	'invalid_email',
	'invalid_language',
	'invalid_role',
	'invalid_password',
	'password_confirm_required',
	'invalid_operator_type',
] as const;

class UserValidator extends BaseValidator<typeof validatorMessages> {
	baseSchema = z.object({
		name: this.validateString(
			{
				invalid: this.getMessage('invalid_name'),
				min_chars: this.getMessage('name_min', {
					min: Configuration.get('user.nameMinChars'),
				}),
			},
			{
				minChars: Configuration.get('user.nameMinChars'),
			},
		),
		email: this.validateEmail(this.getMessage('invalid_email')),
		language: this.validateLanguage(this.getMessage('invalid_language')),
		role: this.validateEnum(UserRoleEnum, this.getMessage('invalid_role')),
		operator_type: this.validateEnum(
			UserOperatorTypeEnum,
			this.getMessage('invalid_operator_type'),
			{ required: false },
		),
	});

	create = this.baseSchema
		.extend({
			password: this.validatePassword(
				{
					invalid_password: this.getMessage('invalid_password'),
					password_min: this.getMessage('password_min', {
						min: Configuration.get('user.passwordMinChars'),
					}),
					password_condition_capital_letter: this.getMessage(
						'password_condition_capital_letter',
					),
					password_condition_number: this.getMessage(
						'password_condition_number',
					),
					password_condition_special_character: this.getMessage(
						'password_condition_special_character',
					),
				},
				{
					minLength: Configuration.get('user.passwordMinChars'),
				},
			),
			password_confirm: this.validateString(
				this.getMessage('password_confirm_required'),
			),
		})
		.superRefine(({ password, password_confirm }, ctx) => {
			if (password !== password_confirm) {
				ctx.addIssue({
					code: 'custom',
					path: ['password_confirm'],
					message: this.getMessage('password_confirm_mismatch'),
				});
			}
		})
		.superRefine(({ role, operator_type }, ctx) => {
			if (role === UserRoleEnum.OPERATOR && !operator_type) {
				ctx.addIssue({
					code: 'custom',
					path: ['operator_type'],
					message: this.getMessage('invalid_operator_type'),
				});
			}
		});

	update = this.baseSchema
		.extend({
			password: this.validatePassword(
				{
					invalid_password: this.getMessage('invalid_password'),
					password_min: this.getMessage('password_min', {
						min: Configuration.get('user.passwordMinChars'),
					}),
					password_condition_capital_letter: this.getMessage(
						'password_condition_capital_letter',
					),
					password_condition_number: this.getMessage(
						'password_condition_number',
					),
					password_condition_special_character: this.getMessage(
						'password_condition_special_character',
					),
				},
				{
					required: false,
					minLength: Configuration.get('user.passwordMinChars'),
				},
			),
			password_confirm: this.validateString(
				this.getMessage('password_confirm_required'),
				{ required: false },
			),
		})
		.superRefine(({ password, password_confirm }, ctx) => {
			if (password || password_confirm) {
				if (!password_confirm) {
					ctx.addIssue({
						code: 'custom',
						path: ['password_confirm'],
						message: this.getMessage('password_confirm_required'),
					});
				} else if (password !== password_confirm) {
					ctx.addIssue({
						code: 'custom',
						path: ['password_confirm'],
						message: this.getMessage('password_confirm_mismatch'),
					});
				}
			}
		})
		.superRefine(({ role, operator_type }, ctx) => {
			if (role === UserRoleEnum.OPERATOR && !operator_type) {
				ctx.addIssue({
					code: 'custom',
					path: ['operator_type'],
					message: this.getMessage('invalid_operator_type'),
				});
			}
		});
}

async function validateFormCreate(values: UserFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'user',
	);

	const validator = new UserValidator(translations);

	return validator.create.safeParse(values);
}

async function validateFormUpdate(values: UserFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'user',
	);

	const validator = new UserValidator(translations);

	return validator.update.safeParse(values);
}

function getFormValues(formData: FormData): UserFormValuesType {
	return {
		name: getFormDataAsString(formData, 'name'),
		email: getFormDataAsString(formData, 'email'),
		password: getFormDataAsString(formData, 'password'),
		password_confirm: getFormDataAsString(formData, 'password_confirm'),
		language:
			getFormDataAsEnum(formData, 'language', LanguageEnum) ||
			getLanguageClient(),
		role:
			getFormDataAsEnum(formData, 'role', UserRoleEnum) ||
			UserRoleEnum.DRIVER,
		operator_type: getFormDataAsEnum(
			formData,
			'operator_type',
			UserOperatorTypeEnum,
		),
	};
}

function getFormState(data?: UserModel): FormStateType<UserFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			name: data?.name ?? null,
			email: data?.email ?? null,
			password: null,
			password_confirm: null,
			language: data?.language ?? LanguageEnum.EN,
			role: data?.role ?? UserRoleEnum.DRIVER,
			operator_type: data?.operator_type ?? null,
		},
	};
}

export type UserDataTableFiltersType = {
	global: { value: string | null; matchMode: 'contains' };
	role: { value: UserRole | null; matchMode: 'equals' };
	status: { value: UserStatus | null; matchMode: 'equals' };
	create_at_start: { value: string | null; matchMode: 'equals' };
	create_at_end: { value: string | null; matchMode: 'equals' };
	is_deleted: { value: boolean; matchMode: 'equals' };
};

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<UserModel>
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
			'setupPermissions.title',
		] as const,
		'user.action',
	);

	function displayButtonView(
		auth: AuthModel | null,
	): DataTableValueOptionsType<UserModel>['displayButton'] {
		return {
			action: () =>
				hasPermission(auth, 'user', 'read') ? 'view' : undefined,
			dataSource: 'user',
		};
	}

	function displayButtonStatus(
		auth: AuthModel | null,
	): DataTableValueOptionsType<UserModel>['displayButton'] {
		return {
			action: (entry: UserModel) => {
				if (entry.deleted_at) {
					return hasPermission(auth, 'user', 'delete')
						? 'restore'
						: undefined;
				}

				if (!hasPermission(auth, 'user', 'update')) {
					return undefined;
				}

				return entry.status === UserStatusEnum.ACTIVE
					? 'disable'
					: 'enable';
			},
		};
	}

	function displayButtonSetupPermissions(
		auth: AuthModel | null,
		entry: UserModel,
	): DataTableValueOptionsType<UserModel>['displayButton'] {
		return {
			action: () =>
				entry.role === UserRoleEnum.OPERATOR &&
				hasPermission(auth, 'permission', 'update')
					? 'setupPermissions'
					: undefined,
			dataSource: 'user',
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
					role: { value: null, matchMode: 'equals' },
					status: { value: null, matchMode: 'equals' },
					create_at_start: { value: null, matchMode: 'equals' },
					create_at_end: { value: null, matchMode: 'equals' },
					is_deleted: { value: false, matchMode: 'equals' },
				} satisfies UserDataTableFiltersType,
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
					field: 'name',
					header: 'Name',
					sortable: true,
				},
				{
					field: 'email',
					header: 'Email',
				},
				{
					field: 'role',
					header: 'Role',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							capitalize: true,
							displayButton: displayButtonSetupPermissions(
								auth,
								entry,
							),
						}),
				},
				{
					field: 'status',
					header: 'Status',
					body: (entry, column, auth) =>
						DataTableValue(entry, column, {
							dataSource: 'user',
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
				requestFind<UserModel>('user', params),
		},
		displayEntryLabel: (entry: UserModel) => {
			return entry.name;
		},
		actions: {
			create: {
				windowType: 'form',
				windowTitle: translations['create.title'],
				windowComponent: FormManageUser,
				permission: ['user', 'create'],
				entriesSelection: 'free',
				operationFunction: (params: UserFormValuesType) =>
					requestCreate<UserModel, UserFormValuesType>(
						'user',
						params,
					),
				buttonPosition: 'right',
				button: {
					variant: 'default',
				},
				getFormValues: getFormValues,
				validateForm: validateFormCreate,
				getFormState: getFormState,
			},
			update: {
				windowType: 'form',
				windowTitle: translations['update.title'],
				windowComponent: FormManageUser,
				permission: ['user', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: UserModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (params: UserFormValuesType, id: number) =>
					requestUpdate<UserModel, UserFormValuesType>(
						'user',
						params,
						id,
					),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
				getFormValues: getFormValues,
				validateForm: validateFormUpdate,
				getFormState: getFormState,
			},
			delete: {
				windowType: 'action',
				windowTitle: translations['delete.title'],
				permission: ['user', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: UserModel) => !entry.deleted_at, // Return true if the entry is not deleted
				operationFunction: (entry: UserModel) =>
					requestDelete('user', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			restore: {
				windowType: 'action',
				windowTitle: translations['restore.title'],
				permission: ['user', 'delete'],
				entriesSelection: 'single',
				customEntryCheck: (entry: UserModel) => !!entry.deleted_at, // Return true if the entry is deleted
				operationFunction: (entry: UserModel) =>
					requestRestore('user', entry),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			enable: {
				windowType: 'action',
				windowTitle: translations['enable.title'],
				permission: ['user', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: UserModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [
						UserStatusEnum.PENDING,
						UserStatusEnum.INACTIVE,
					]),
				operationFunction: (entry: UserModel) =>
					requestUpdateStatus('user', entry, 'active'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'default',
				},
			},
			disable: {
				windowType: 'action',
				windowTitle: translations['disable.title'],
				permission: ['user', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: UserModel) =>
					!entry.deleted_at &&
					arrayHasValue(entry.status, [
						UserStatusEnum.PENDING,
						UserStatusEnum.ACTIVE,
					]),
				operationFunction: (entry: UserModel) =>
					requestUpdateStatus('user', entry, 'inactive'),
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'error',
				},
			},
			view: {
				windowType: 'view',
				windowTitle: translations['view.title'],
				windowComponent: ViewUser,
				windowConfigProps: {
					size: 'xl',
				},
				permission: ['user', 'read'],
				entriesSelection: 'single',
				buttonPosition: 'hidden',
			},
			setupPermissions: {
				windowType: 'other',
				windowTitle: translations['setupPermissions.title'],
				windowComponent: SetupUserPermissions,
				windowConfigProps: {
					size: 'lg',
				},
				permission: ['permission', 'update'],
				entriesSelection: 'single',
				customEntryCheck: (entry: UserModel) =>
					!entry.deleted_at && entry.role === UserRoleEnum.OPERATOR,
				buttonPosition: 'left',
				button: {
					variant: 'outline',
					hover: 'success',
				},
			},
		},
	};
}
