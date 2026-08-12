import type { AccountDeleteFormValuesType } from '@/app/(public)/account/delete/account-delete.definition';
import type { AccountEditFormValuesType } from '@/app/(public)/account/edit/account-edit.definition';
import type { EmailConfirmSendFormValuesType } from '@/app/(public)/account/email-confirm-send/email-confirm-send.definition';
import type { EmailUpdateFormValuesType } from '@/app/(public)/account/email-update/email-update.definition';
import type {
	LoginApiResponseType,
	LoginFormValuesType,
} from '@/app/(public)/account/login/login.definition';
import type { PasswordRecoverFormValuesType } from '@/app/(public)/account/password-recover/password-recover.definition';
import type { PasswordRecoverChangeFormValuesType } from '@/app/(public)/account/password-recover-change/[token]/password-recover-change.definition';
import type { PasswordUpdateFormValuesType } from '@/app/(public)/account/password-update/password-update.definition';
import type { RegisterFormValuesType } from '@/app/(public)/account/register/register.definition';
import { ApiRequest } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import type { UserModel } from '@/models/user.model';
import type { ApiResponseFetch } from '@/types/api.type';
import type { AuthTokenType } from '@/types/auth.type';
import type { OAuthIdentityType, OAuthProvider } from '@/types/oauth.type';

export async function requestRegister(
	params: RegisterFormValuesType,
): Promise<ApiResponseFetch<UserModel>> {
	return await new ApiRequest().doFetch('/account/register', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestLogin(
	params: LoginFormValuesType,
): Promise<ApiResponseFetch<LoginApiResponseType>> {
	return await new ApiRequest().doFetch('/account/login', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Redeems a provider authorization code for a session.
 *
 * The code is exchanged by the backend, not here — the client secret never reaches the
 * browser. `redirect_uri` has to be the exact value used to obtain the code, which is why
 * both legs build it from `getOAuthRedirectUri`.
 *
 * The response mirrors `/account/login`, max-active-sessions case included.
 */
export async function requestOAuthLogin(
	provider: OAuthProvider,
	code: string,
	redirect_uri: string,
): Promise<ApiResponseFetch<LoginApiResponseType>> {
	return await new ApiRequest().doFetch(`/account/oauth/${provider}`, {
		method: 'POST',
		body: JSON.stringify({ code, redirect_uri }),
	});
}

export async function requestGetOAuthIdentities(): Promise<
	OAuthIdentityType[]
> {
	try {
		const fetchResponse: ApiResponseFetch<OAuthIdentityType[]> =
			await new ApiRequest().doFetch('/account/oauth', {
				method: 'GET',
			});

		if (fetchResponse?.success) {
			return fetchResponse.data || [];
		}
	} catch (error: unknown) {
		// Same reasoning as `requestGetSessions`: the caller renders a list, so a failure
		// degrades to "nothing linked" rather than an error state.
		logger.error('Failed to load linked sign-in providers', error);
	}

	return [];
}

export async function requestUnlinkOAuth(
	provider: OAuthProvider,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/account/oauth/${provider}`, {
		method: 'DELETE',
	});
}

export async function requestRemoveAuthToken(
	token: string,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/account/token', {
		method: 'DELETE',
		body: JSON.stringify({
			ident: token,
		}),
	});
}

export async function requestLogout(): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/account/logout', {
		method: 'DELETE',
	});
}

export async function requestPasswordRecover(
	params: PasswordRecoverFormValuesType,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/account/password-recover', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestPasswordRecoverChange(
	params: PasswordRecoverChangeFormValuesType,
	token: string,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/account/password-recover-change/${token}`,
		{
			method: 'POST',
			body: JSON.stringify(params),
		},
	);
}

export async function requestEmailConfirmSend(
	params: EmailConfirmSendFormValuesType,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/account/email-confirm-send', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestEmailConfirm(
	token: string,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/account/email-confirm/${token}`, {
			method: 'POST',
			next: { revalidate: 3600 },
		});
}

export async function requestGetSessions(): Promise<AuthTokenType[]> {
	try {
		const fetchResponse: ApiResponseFetch<AuthTokenType[]> =
			await new ApiRequest().doFetch('/account/me/sessions', {
				method: 'GET',
			});

		if (fetchResponse?.success) {
			return fetchResponse.data || [];
		}
	} catch (error: unknown) {
		// The caller renders a list, so a failure degrades to "no sessions" rather than an
		// error state — which is indistinguishable from a genuinely empty list on screen.
		// The log is the only trace that the request failed at all.
		logger.error('Failed to load account sessions', error);
	}

	return [];
}

export async function requestEditAccount(
	params: AccountEditFormValuesType,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/account/me/edit', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestPasswordUpdate(
	params: PasswordUpdateFormValuesType,
): Promise<ApiResponseFetch<{ token: string }>> {
	return await new ApiRequest().doFetch('/account/password-update', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestEmailUpdate(
	params: EmailUpdateFormValuesType,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/account/email-update', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

export async function requestDeleteAccount(
	params: AccountDeleteFormValuesType,
): Promise<ApiResponseFetch<{ token: string }>> {
	return await new ApiRequest().doFetch('/account/me/delete', {
		method: 'DELETE',
		body: JSON.stringify(params),
	});
}
