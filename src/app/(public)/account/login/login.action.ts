import {
	getLoginFormValues,
	type LoginFormValuesType,
	type LoginStateType,
	validateFormLogin,
} from '@/app/(public)/account/login/login.definition';
import { translate } from '@/config/translate.setup';
import { processForm } from '@/helpers/form-process.helper';
import { requestLogin } from '@/services/account.service';
import { createAuth } from '@/services/auth.service';

/**
 * Login is a two-step operation: the backend returns a token, which only becomes
 * a session once `createAuth` has written the cookie. Both steps live here so the
 * form only reports success after the session actually exists.
 */
async function loginOperation(values: LoginFormValuesType) {
	const requestResponse = await requestLogin(values);

	if (
		requestResponse?.success &&
		requestResponse.data &&
		'token' in requestResponse.data
	) {
		return createAuth(requestResponse.data.token);
	}

	// A response without a token is a failure even if the backend flagged success.
	return {
		...requestResponse,
		message: requestResponse?.message ?? '',
		success: false,
	};
}

export async function loginAction(
	formState: LoginStateType,
	formData: FormData,
): Promise<LoginStateType> {
	return processForm(formState, formData, {
		getFormValues: getLoginFormValues,
		validateForm: validateFormLogin,
		operationFunction: loginOperation,
		fallbackErrorKey: 'login.message.could_not_login',
		mapApiError: async (error) => {
			switch (error.status) {
				case 400:
					return {
						message: await translate('login.message.not_active'),
					};
				case 403:
					return {
						message: await translate(
							'login.message.max_active_sessions',
						),
						situation: 'maxActiveSession' as const,
						resultData: error.body?.data,
					};
				case 406:
					// Already logged in — treat as a successful sign-in.
					return { situation: 'success' as const };
				case 409:
					return {
						message: await translate(
							'login.message.pending_account',
						),
						situation: 'pendingAccount' as const,
					};
				default:
					return {};
			}
		},
	});
}
