import { z } from 'zod';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import {
	getFormDataAsBoolean,
	getFormDataAsEnum,
	getFormDataAsString,
} from '@/helpers/form.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import { type Language, LanguageEnum } from '@/types/common.type';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

export const REGISTER_TRANSLATION_KEYS = [
	'register.form.title',
	'register.form.description',
	'register.form.title_status',
	'register.form.success_description',
	'register.field.name',
	'register.field.email',
	'register.field.password',
	'register.field.password_confirm',
	'register.field.password_confirm_placeholder',
	'register.field.language',
	'register.action.submit',
	'register.action.oauth',
	'oauth.action.continue_with',
	'register.link.confirm_email_prompt',
	'register.link.confirm_email',
	'register.link.verification_sent',
	'register.link.verification_check',
	'register.link.back_home_prompt',
	'register.link.back_home',
	'register.link.already_registered',
	'register.link.sign_in',
	'register.link.terms_prompt',
	'register.link.terms_of_service',
	'register.link.terms_separator',
	'register.link.terms_title',
	'register.link.privacy_policy',
	'register.link.privacy_title',
] as const;

export type RegisterTranslations = Record<
	(typeof REGISTER_TRANSLATION_KEYS)[number],
	string
>;

export type RegisterFormValuesType = {
	name: string | null;
	email: string | null;
	password: string | null;
	password_confirm: string | null;
	language: Language;
	terms: boolean;
};

export type RegisterSituationType = FormSituationType | 'pendingAccount';

export type RegisterStateType = {
	values: RegisterFormValuesType;
	errors: FormErrorsType<RegisterFormValuesType>;
	message: string | null;
	situation: RegisterSituationType;
};

export const RegisterState: RegisterStateType = {
	values: {
		name: '',
		email: '',
		password: '',
		password_confirm: '',
		language: Configuration.defaultLanguage(),
		terms: false,
	},
	errors: {},
	message: null,
	situation: null,
};

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_name',
	'invalid_email',
	'invalid_password',
	'password_confirm_required',
	'invalid_language',
	'terms_required',
] as const;

class RegisterValidator extends BaseValidator<typeof validatorMessages> {
	register = z
		.object({
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
			language: this.validateLanguage(
				this.getMessage('invalid_language'),
			),
			terms: this.validateBoolean(this.getMessage('terms_required')),
		})
		.superRefine(({ password, password_confirm }, ctx) => {
			if (password !== password_confirm) {
				ctx.addIssue({
					path: ['password_confirm'],
					message: this.getMessage('password_confirm_mismatch'),
					code: 'custom',
				});
			}
		});
}

export async function validateFormRegister(values: RegisterFormValuesType) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'register',
	);

	const validator = new RegisterValidator(translations);

	return validator.register.safeParse(values);
}

export function getRegisterFormValues(
	formData: FormData,
): RegisterFormValuesType {
	return {
		name: getFormDataAsString(formData, 'name'),
		email: getFormDataAsString(formData, 'email'),
		password: getFormDataAsString(formData, 'password'),
		password_confirm: getFormDataAsString(formData, 'password_confirm'),
		language:
			getFormDataAsEnum(formData, 'language', LanguageEnum) ||
			getLanguageClient(),
		terms: getFormDataAsBoolean(formData, 'terms') || false,
	};
}
