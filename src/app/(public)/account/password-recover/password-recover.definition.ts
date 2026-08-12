import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsString } from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

export const PASSWORD_RECOVER_TRANSLATION_KEYS = [
	'password-recover.form.title',
	'password-recover.form.description',
	'password-recover.form.success_description',
	'password-recover.field.email',
	'password-recover.action.submit',
	'password-recover.link.back_home_prompt',
	'password-recover.link.back_home',
	'password-recover.link.not_registered',
	'password-recover.link.create_account',
] as const;

export type PasswordRecoverTranslations = Record<
	(typeof PASSWORD_RECOVER_TRANSLATION_KEYS)[number],
	string
>;

export type PasswordRecoverFormValuesType = {
	email: string | null;
};

export type PasswordRecoverSituationType = FormSituationType;

export type PasswordRecoverStateType = {
	values: PasswordRecoverFormValuesType;
	errors: FormErrorsType<PasswordRecoverFormValuesType>;
	message: string | null;
	situation: PasswordRecoverSituationType;
};

export const PasswordRecoverState: PasswordRecoverStateType = {
	values: {
		email: '',
	},
	errors: {},
	message: null,
	situation: null,
};

const validatorMessages = ['invalid_email'] as const;

class PasswordRecoverValidator extends BaseValidator<typeof validatorMessages> {
	passwordRecover = z.object({
		email: this.validateEmail(this.getMessage('invalid_email')),
	});
}

export async function validateFormPasswordRecover(
	values: PasswordRecoverFormValuesType,
) {
	const translations = await translateBatch(
		validatorMessages,
		'password-recover.validation',
	);

	const validator = new PasswordRecoverValidator(translations);

	return validator.passwordRecover.safeParse(values);
}

export function getPasswordRecoverFormValues(
	formData: FormData,
): PasswordRecoverFormValuesType {
	return {
		email: getFormDataAsString(formData, 'email'),
	};
}
