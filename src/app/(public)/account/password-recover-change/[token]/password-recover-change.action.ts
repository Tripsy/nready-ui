import {
	getPasswordRecoverChangeFormValues,
	type PasswordRecoverChangeFormValuesType,
	type PasswordRecoverChangeStateType,
	validateFormPasswordRecoverChange,
} from '@/app/(public)/account/password-recover-change/[token]/password-recover-change.definition';
import { processForm } from '@/helpers/form-process.helper';
import { requestPasswordRecoverChange } from '@/services/account.service';

export async function passwordRecoverChangeAction(
	formState: PasswordRecoverChangeStateType,
	formData: FormData,
): Promise<PasswordRecoverChangeStateType> {
	return processForm(formState, formData, {
		getFormValues: getPasswordRecoverChangeFormValues,
		validateForm: validateFormPasswordRecoverChange,
		// The recovery token is carried on the form state, not the form values.
		operationFunction: (values: PasswordRecoverChangeFormValuesType) =>
			requestPasswordRecoverChange(values, formState.token),
		fallbackErrorKey: 'password-recover-change.message.failed',
		mapApiError: async (error) => ({ message: error.message }),
	});
}
