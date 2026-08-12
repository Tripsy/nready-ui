import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsString } from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import type { AuthTokenType } from '@/types/auth.type';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

/**
 * Resolved by the server page and handed to the client component as props, rather than
 * read there through `useTranslation`: that hook can only seed itself from an effect, so
 * every key would render empty in the SSR HTML and pop in after hydration.
 *
 * The list lives here rather than in the `'use client'` component because a named export
 * crossing the client boundary reaches the server as a client reference, not as the array.
 */
export const LOGIN_TRANSLATION_KEYS = [
	'app.error.title',
	'app.success.title',
	'login.form.title',
	'login.form.description',
	'login.form.title_status',
	'login.field.email',
	'login.field.password',
	'login.action.submit',
	'login.action.oauth',
	'oauth.action.continue_with',
	'login.link.no_account',
	'login.link.create_account',
	'login.link.forgot_password',
	'login.link.reset_password',
	'login.link.confirm_email_prompt',
	'login.link.confirm_email',
	'login.message.session_destroy_success',
	'login.message.session_destroy_error',
] as const;

export type LoginTranslations = Record<
	(typeof LOGIN_TRANSLATION_KEYS)[number],
	string
>;

export type LoginFormValuesType = {
	email: string | null;
	password: string | null;
};

export type LoginSituationType =
	| FormSituationType
	| 'maxActiveSession'
	| 'pendingAccount';

export type LoginApiResponseType =
	| { token: string }
	| { authTokens: AuthTokenType[] };

export type LoginStateType = {
	values: LoginFormValuesType;
	errors: FormErrorsType<LoginFormValuesType>;
	message: string | null;
	situation: LoginSituationType;
	resultData?: LoginApiResponseType;
};

export const LoginState: LoginStateType = {
	values: {
		email: '',
		password: '',
	},
	errors: {},
	message: null,
	situation: null,
};

const validatorMessages = ['invalid_email', 'invalid_password'] as const;

class LoginValidator extends BaseValidator<typeof validatorMessages> {
	login = z.object({
		email: this.validateEmail(this.getMessage('invalid_email')),
		password: this.validateString(this.getMessage('invalid_password')),
	});
}

export async function validateFormLogin(values: LoginFormValuesType) {
	const translations = await translateBatch(
		validatorMessages,
		'login.validation',
	);

	const validator = new LoginValidator(translations);

	return validator.login.safeParse(values);
}

export function getLoginFormValues(formData: FormData): LoginFormValuesType {
	return {
		email: getFormDataAsString(formData, 'email'),
		password: getFormDataAsString(formData, 'password'),
	};
}

export const isLoginResponseMaxActiveSessions = (
	response: LoginApiResponseType,
): response is { authTokens: AuthTokenType[] } => {
	return 'authTokens' in response;
};

export const isLoginResponseSuccess = (
	response: LoginApiResponseType,
): response is { token: string } => {
	return 'token' in response;
};
