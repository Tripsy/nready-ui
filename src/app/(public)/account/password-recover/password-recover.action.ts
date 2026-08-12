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
				default:
					return { message: error.message };
			}
		},
	});
}
