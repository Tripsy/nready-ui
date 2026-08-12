import { FormManageAccountDelete } from '@/app/(public)/_components/account/form-manage-account-delete.component';
import { FormManageAccountEdit } from '@/app/(public)/_components/account/form-manage-account-edit.component';
import { FormManageEmailUpdate } from '@/app/(public)/_components/account/form-manage-email-update.component';
import { FormManagePasswordUpdate } from '@/app/(public)/_components/account/form-manage-password-update.component';
import {
	type AccountDeleteFormValuesType,
	getAccountDeleteFormValues,
	validateFormAccountDelete,
} from '@/app/(public)/account/delete/account-delete.definition';
import {
	type AccountEditFormValuesType,
	validateFormAccountEdit,
} from '@/app/(public)/account/edit/account-edit.definition';
import {
	type EmailUpdateFormValuesType,
	getEmailUpdateFormValues,
	validateFormEmailUpdate,
} from '@/app/(public)/account/email-update/email-update.definition';
import {
	getPasswordUpdateFormValues,
	type PasswordUpdateFormValuesType,
	validateFormPasswordUpdate,
} from '@/app/(public)/account/password-update/password-update.definition';
import { Configuration } from '@/config/settings.config';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsEnum, getFormDataAsString } from '@/helpers/form.helper';
import type { UserModel } from '@/models/user.model';
import {
	requestDeleteAccount,
	requestEditAccount,
	requestEmailUpdate,
	requestPasswordUpdate,
} from '@/services/account.service';
import type { ApiResponseFetch } from '@/types/api.type';
import { LanguageEnum } from '@/types/common.type';
import type { DataSourceConfigType } from '@/types/data-source.type';
import type { FormStateType } from '@/types/form.type';

// The account service functions resolve to ApiResponseFetch<null> / <{ token }>;
// the WindowForm operationFunction is typed against the data source's entry
// (UserModel). processForm only reads success/message/data, so this adapter
// normalizes the response shape without touching runtime behavior.
const asUserResult = <T>(
	response: Promise<ApiResponseFetch<T>>,
): Promise<ApiResponseFetch<Partial<UserModel>>> =>
	response as unknown as Promise<ApiResponseFetch<Partial<UserModel>>>;

// Account self-service is gated by authentication only (see routes.setup) — the
// backend enforces no permission entity here, and these windows are opened
// directly (never through the dashboard data-table that reads `permission`), so
// `permission` is intentionally omitted from every action below.

// processForm calls getFormValues synchronously, so the language fallback can't
// await getLanguage() — here it always comes from the form's radio anyway.
function getAccountEditFormValues(
	formData: FormData,
): AccountEditFormValuesType {
	return {
		name: getFormDataAsString(formData, 'name'),
		language:
			getFormDataAsEnum(formData, 'language', LanguageEnum) ||
			Configuration.defaultLanguage(),
	};
}

function getAccountEditFormState(
	entry?: UserModel,
): FormStateType<AccountEditFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			name: entry?.name ?? '',
			language: entry?.language ?? Configuration.defaultLanguage(),
		},
	};
}

function getEmailUpdateFormState(): FormStateType<EmailUpdateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: { email_new: '' },
	};
}

function getPasswordUpdateFormState(): FormStateType<PasswordUpdateFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: {
			password_current: '',
			password_new: '',
			password_confirm: '',
		},
	};
}

function getAccountDeleteFormState(): FormStateType<AccountDeleteFormValuesType> {
	return {
		errors: {},
		message: null,
		situation: null,
		values: { password_current: '' },
	};
}

export default async function dataSourceConfig(): Promise<
	DataSourceConfigType<UserModel>
> {
	const translations = await translateBatch(
		[
			'edit.title',
			'emailUpdate.title',
			'passwordUpdate.title',
			'deleteAccount.title',
			'edit.submit',
			'emailUpdate.submit',
			'passwordUpdate.submit',
			'deleteAccount.submit',
		] as const,
		'account.action',
	);

	return {
		displayEntryLabel: (entry: UserModel) => entry.name || entry.email,
		actions: {
			edit: {
				windowType: 'form',
				windowTitle: translations['edit.title'],
				windowComponent: FormManageAccountEdit,
				// Account forms are short, single-purpose flows — submit or cancel, no parking them in the dock
				windowConfigProps: { allowMinimize: false },
				// `single`: the current user is passed as the entry so the form
				// can prefill name/language; the id argument is unused (the
				// backend resolves the account from the session).
				entriesSelection: 'single',
				operationFunction: (values: AccountEditFormValuesType) =>
					asUserResult(requestEditAccount(values)),
				buttonPosition: 'hidden',
				button: { icon: 'save', label: translations['edit.submit'] },
				getFormValues: getAccountEditFormValues,
				validateForm: validateFormAccountEdit,
				getFormState: getAccountEditFormState,
			},
			emailUpdate: {
				windowType: 'form',
				windowTitle: translations['emailUpdate.title'],
				windowComponent: FormManageEmailUpdate,
				// Account forms are short, single-purpose flows — submit or cancel, no parking them in the dock
				windowConfigProps: { allowMinimize: false },
				entriesSelection: 'free',
				operationFunction: (values: EmailUpdateFormValuesType) =>
					asUserResult(requestEmailUpdate(values)),
				buttonPosition: 'hidden',
				button: {
					icon: 'save',
					label: translations['emailUpdate.submit'],
				},
				getFormValues: getEmailUpdateFormValues,
				validateForm: validateFormEmailUpdate,
				getFormState: getEmailUpdateFormState,
			},
			passwordUpdate: {
				windowType: 'form',
				windowTitle: translations['passwordUpdate.title'],
				windowComponent: FormManagePasswordUpdate,
				// Account forms are short, single-purpose flows — submit or cancel, no parking them in the dock
				windowConfigProps: { allowMinimize: false },
				entriesSelection: 'free',
				operationFunction: (values: PasswordUpdateFormValuesType) =>
					asUserResult(requestPasswordUpdate(values)),
				buttonPosition: 'hidden',
				button: {
					icon: 'save',
					label: translations['passwordUpdate.submit'],
				},
				getFormValues: getPasswordUpdateFormValues,
				validateForm: validateFormPasswordUpdate,
				getFormState: getPasswordUpdateFormState,
			},
			// Named `deleteAccount` (not `delete`): the reserved `delete` action
			// key is typed as an `action`-type confirm dialog, not a `form`.
			deleteAccount: {
				windowType: 'form',
				windowTitle: translations['deleteAccount.title'],
				windowComponent: FormManageAccountDelete,
				// Account forms are short, single-purpose flows — submit or cancel, no parking them in the dock
				windowConfigProps: { allowMinimize: false },
				entriesSelection: 'free',
				operationFunction: (values: AccountDeleteFormValuesType) =>
					asUserResult(requestDeleteAccount(values)),
				buttonPosition: 'hidden',
				button: {
					variant: 'error',
					icon: 'destroy',
					label: translations['deleteAccount.submit'],
				},
				getFormValues: getAccountDeleteFormValues,
				validateForm: validateFormAccountDelete,
				getFormState: getAccountDeleteFormState,
			},
		},
	};
}
