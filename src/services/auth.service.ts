'use server';

import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import { clearCachedAccountModel } from '@/helpers/auth-cache.helper';
import {
	deleteCookie,
	getCookie,
	getTrackedCookie,
	setupTrackedCookie,
} from '@/helpers/session.helper';
import { apiHeaders } from '@/helpers/system.helper';
import { type AccountModel, prepareAccountModel } from '@/models/account.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Drops the session cookie *and* the proxy's cached `/account/me` entry.
 *
 * Clearing only the cookie would leave the cached auth model authorizing the token for the
 * rest of its TTL, so the two always have to be torn down together.
 *
 * @param sessionToken - the current token when the caller already has it; re-read otherwise
 */
async function destroySession(sessionToken?: string): Promise<void> {
	const cookieName = Configuration.get('user.sessionToken');
	const token = sessionToken ?? (await getCookie(cookieName));

	if (token) {
		await clearCachedAccountModel(token);
	}

	await deleteCookie(cookieName);
}

/*
 * Sessions are created by the `/api/auth/session` and `/api/auth/oauth/:provider` route
 * handlers, not from here. A server action that writes a session cookie cannot be called from a
 * form pipeline without resetting the page that called it, and as an action it also sat outside
 * the CSRF gate that every mutating `/api/` request passes.
 */

export async function getAuth(): Promise<ApiResponseFetch<AccountModel | null>> {
	try {
		const sessionToken = await getTrackedCookie(
			Configuration.get('user.sessionToken'),
			Configuration.get('user.sessionRefreshThreshold'),
		);

		if (!sessionToken.value) {
			return {
				data: null,
				message: 'Could not retrieve auth model (eg: no session token)',
				success: false,
			};
		}

		const fetchResponse: ApiResponseFetch<AccountModel> | undefined =
			await new ApiRequest()
				.setRequestMode('remote-api')
				.doFetch('/account/me', {
					method: 'GET',
					headers: {
						Authorization: `Bearer ${sessionToken.value}`,
						...(await apiHeaders()),
					},
				});

		if (fetchResponse?.success) {
			const responseData = getResponseData(fetchResponse);

			if (responseData) {
				const accountModel = prepareAccountModel(responseData);

				await setupTrackedCookie(sessionToken, {
					httpOnly: true,
					maxAge: Configuration.get('user.sessionMaxAge'),
				});

				return {
					data: accountModel,
					message: 'Ok',
					success: true,
				};
			}
		}

		await destroySession(sessionToken.value);

		return {
			data: null,
			message:
				fetchResponse?.message ||
				'Could not retrieve auth model (eg: unknown error)',
			success: false,
		};
	} catch (error: unknown) {
		if (error instanceof ApiError && error.status === 401) {
			await destroySession();
		}

		return {
			data: null,
			message:
				error instanceof Error
					? error.message
					: 'Could not retrieve auth model (eg: unknown error)',
			success: false,
		};
	}
}

export async function clearAuth(): Promise<ApiResponseFetch<null>> {
	await destroySession();

	return {
		message: await translate('logout.message.success'),
		success: true,
	};
}
