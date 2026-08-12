import {
	getPasswordRecoverFormValues,
	type PasswordRecoverStateType,
	validateFormPasswordRecover,
} from '@/app/(public)/account/password-recover/password-recover.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import { requestPasswordRecover } from '@/services/account.service';

export async function passwordRecoverAction(
	formState: PasswordRecoverStateType,
	formData: FormData,
): Promise<PasswordRecoverStateType> {
	return processForm(formState, formData, {
		getFormValues: getPasswordRecoverFormValues,
		validateForm: validateFormPasswordRecover,
		operationFunction: requestPasswordRecover,
		fallbackErrorKey: 'password-recover.message.failed',
		mapApiError: async (error) => {
			switch (error.status) {
				case 425:
					return {
						message: await translate(
							'password-recover.message.recovery_attempts_exceeded',
						),
					};
				case 404:
					return {
						message: await translate(
							'password-recover.message.not_active',
						),
					};
				// Ahead of the `error.message` default: the throttler's own body text is
				// resolved in the backend's language, not the one this page is rendered in.
				case 429:
					return {
						message: await translate('app.error.rate_limited'),
					};
				default:
					return { message: error.message };
			}
		},
	});
}
