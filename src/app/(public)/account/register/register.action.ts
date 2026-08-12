import {
	getRegisterFormValues,
	type RegisterStateType,
	validateFormRegister,
} from '@/app/(public)/account/register/register.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import { requestRegister } from '@/services/account.service';

export async function registerAction(
	formState: RegisterStateType,
	formData: FormData,
): Promise<RegisterStateType> {
	return processForm(formState, formData, {
		getFormValues: getRegisterFormValues,
		validateForm: validateFormRegister,
		operationFunction: requestRegister,
		mapApiError: async (error) => {
			switch (error.status) {
				case 409:
					return {
						message: await translate(
							'register.message.pending_account',
						),
						situation: 'pendingAccount' as const,
					};
				default:
					return {};
			}
		},
	});
}
