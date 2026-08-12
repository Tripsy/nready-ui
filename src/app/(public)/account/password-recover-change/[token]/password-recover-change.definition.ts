import { z } from 'zod';
import { Configuration } from '@/config/settings.config';
import { getFormDataAsString } from '@/helpers/form.helper';
import {
	BaseValidator,
	resolveValidatorMessages,
	sharedValidatorMessages,
} from '@/helpers/validator.helper';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

export const PASSWORD_RECOVER_CHANGE_TRANSLATION_KEYS = [
	'password-recover-change.form.title',
	'password-recover-change.form.description',
	'password-recover-change.form.success_description',
	'password-recover-change.field.password',
	'password-recover-change.field.password_confirm',
	'password-recover-change.field.password_confirm_placeholder',
	'password-recover-change.action.submit',
	'password-recover-change.link.sign_in_prompt',
	'password-recover-change.link.sign_in',
	'password-recover-change.link.sign_in_suffix',
] as const;

export type PasswordRecoverChangeTranslations = Record<
	(typeof PASSWORD_RECOVER_CHANGE_TRANSLATION_KEYS)[number],
	string
>;

export type PasswordRecoverChangeFormValuesType = {
	password: string | null;
	password_confirm: string | null;
};

export type PasswordRecoverChangeSituationType = FormSituationType;

export type PasswordRecoverChangeStateType = {
	token: string;
	values: PasswordRecoverChangeFormValuesType;
	errors: FormErrorsType<PasswordRecoverChangeFormValuesType>;
	message: string | null;
	situation: PasswordRecoverChangeSituationType;
};

export const PasswordRecoverChangeState: PasswordRecoverChangeStateType = {
	token: '',
	values: {
		password: '',
		password_confirm: '',
	},
	errors: {},
	message: null,
	situation: null,
};

const validatorMessages = [
	...sharedValidatorMessages,
	'invalid_password',
	'password_confirm_required',
] as const;

class PasswordRecoverChangeValidator extends BaseValidator<
	typeof validatorMessages
> {
	passwordRecoverChange = z
		.object({
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
					path: ['password_confirm'],
					message: this.getMessage('password_confirm_mismatch'),
					code: 'custom',
				});
			}
		});
}

export async function validateFormPasswordRecoverChange(
	values: PasswordRecoverChangeFormValuesType,
) {
	const translations = await resolveValidatorMessages(
		validatorMessages,
		'password-recover-change',
	);

	const validator = new PasswordRecoverChangeValidator(translations);

	return validator.passwordRecoverChange.safeParse(values);
}

export function getPasswordRecoverChangeFormValues(
	formData: FormData,
): PasswordRecoverChangeFormValuesType {
	return {
		password: getFormDataAsString(formData, 'password'),
		password_confirm: getFormDataAsString(formData, 'password_confirm'),
	};
}
