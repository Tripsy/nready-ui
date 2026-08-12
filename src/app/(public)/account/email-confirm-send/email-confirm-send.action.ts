import {
	type EmailConfirmSendStateType,
	getEmailConfirmSendFormValues,
	validateFormEmailConfirmSend,
} from '@/app/(public)/account/email-confirm-send/email-confirm-send.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import { requestEmailConfirmSend } from '@/services/account.service';

export async function emailConfirmSendAction(
	formState: EmailConfirmSendStateType,
	formData: FormData,
): Promise<EmailConfirmSendStateType> {
	return processForm(formState, formData, {
		getFormValues: getEmailConfirmSendFormValues,
		validateForm: validateFormEmailConfirmSend,
		operationFunction: requestEmailConfirmSend,
		fallbackErrorKey: 'email-confirm-send.message.failed',
		mapApiError: async (error) => {
			switch (error.status) {
				case 403:
					return {
						message: await translate(
							'email-confirm-send.message.not_allowed',
						),
					};
				case 404:
					return {
						message: await translate(
							'email-confirm-send.message.not_active',
						),
					};
				default:
					return { message: error.message };
			}
		},
	});
}
