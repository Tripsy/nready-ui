import { z } from 'zod';
import { translateBatch } from '@/config/translate.setup';
import { getFormDataAsString } from '@/helpers/form.helper';
import { BaseValidator } from '@/helpers/validator.helper';
import type { FormErrorsType, FormSituationType } from '@/types/form.type';

export const EMAIL_CONFIRM_SEND_TRANSLATION_KEYS = [
	'email-confirm-send.form.title',
	'email-confirm-send.form.description',
	'email-confirm-send.form.title_status',
	'email-confirm-send.form.title_success',
	'email-confirm-send.form.success_description',
	'email-confirm-send.field.email',
	'email-confirm-send.action.submit',
	'email-confirm-send.link.back_home_prompt',
	'email-confirm-send.link.back_home',
	'email-confirm-send.link.not_registered',
	'email-confirm-send.link.create_account',
] as const;

export type EmailConfirmSendTranslations = Record<
	(typeof EMAIL_CONFIRM_SEND_TRANSLATION_KEYS)[number],
	string
>;

export type EmailConfirmSendFormValuesType = {
	email: string | null;
};

export type EmailConfirmSendSituationType = FormSituationType;

export type EmailConfirmSendStateType = {
	values: EmailConfirmSendFormValuesType;
	errors: FormErrorsType<EmailConfirmSendFormValuesType>;
	message: string | null;
	situation: EmailConfirmSendSituationType;
};

export const EmailConfirmSendState: EmailConfirmSendStateType = {
	values: {
		email: '',
	},
	errors: {},
	message: null,
	situation: null,
};

const validatorMessages = ['invalid_email'] as const;

class EmailConfirmSendValidator extends BaseValidator<
	typeof validatorMessages
> {
	emailConfirmSend = z.object({
		email: this.validateEmail(this.getMessage('invalid_email')),
	});
}

export async function validateFormEmailConfirmSend(
	values: EmailConfirmSendFormValuesType,
) {
	const translations = await translateBatch(
		validatorMessages,
		'email-confirm-send.validation',
	);

	const validator = new EmailConfirmSendValidator(translations);

	return validator.emailConfirmSend.safeParse(values);
}

export function getEmailConfirmSendFormValues(
	formData: FormData,
): EmailConfirmSendFormValuesType {
	return {
		email: getFormDataAsString(formData, 'email'),
	};
}
