'use server';

import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { ApiRequest, getResponseData } from '@/helpers/api.helper';
import { clearCachedAuthModel } from '@/helpers/auth-cache.helper';
import {
	deleteCookie,
	getCookie,
	getTrackedCookie,
	setupTrackedCookie,
} from '@/helpers/session.helper';
import { apiHeaders } from '@/helpers/system.helper';
import { type AuthModel, prepareAuthModel } from '@/models/auth.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Drops the session cookie *and* the proxy's cached `/account/me` entry.
 *
 * Clearing only the cookie would leave the cached auth model authorising the token for the
 * rest of its TTL, so the two always have to be torn down together.
 *
 * @param sessionToken - the current token when the caller already has it; re-read otherwise
 */
async function destroySession(sessionToken?: string): Promise<void> {
	const cookieName = Configuration.get('user.sessionToken');
	const token = sessionToken ?? (await getCookie(cookieName));

	if (token) {
		await clearCachedAuthModel(token);
	}

	await deleteCookie(cookieName);
}

export async function createAuth(
	sessionToken: string,
): Promise<ApiResponseFetch<null>> {
	if (!sessionToken) {
		return {
			message: 'No token provided',
			success: false,
		};
	}

	await setupTrackedCookie(
		{
			action: 'set',
			name: Configuration.get('user.sessionToken'),
			value: sessionToken,
		},
		{
			httpOnly: true,
			maxAge: Configuration.get('user.sessionMaxAge'),
		},
	);

	return {
		message: await translate('login.message.auth_success'),
		success: true,
	};
}

export async function getAuth(): Promise<ApiResponseFetch<AuthModel | null>> {
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

		const fetchResponse: ApiResponseFetch<AuthModel> | undefined =
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
				const authModel = prepareAuthModel(responseData);

				await setupTrackedCookie(sessionToken, {
					httpOnly: true,
					maxAge: Configuration.get('user.sessionMaxAge'),
				});

				return {
					data: authModel,
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
