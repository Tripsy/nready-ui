'use server';

import type {
	OAuthCallbackSituationType,
	OAuthCallbackStateType,
} from '@/app/(public)/account/oauth/[provider]/oauth-callback.definition';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { logger } from '@/helpers/logger.helper';
import { deleteCookie, getCookie } from '@/helpers/session.helper';
import { requestOAuthLogin } from '@/services/account.service';
import { createAuth } from '@/services/auth.service';
import type { AuthTokenType } from '@/types/auth.type';
import {
	getOAuthRedirectUri,
	isOAuthProvider,
	type OAuthProvider,
} from '@/types/oauth.type';

type StateCookiePayload = {
	state: string;
	from: string;
};

async function fail(
	messageKey: string,
	situation: OAuthCallbackSituationType = 'error',
): Promise<OAuthCallbackStateType> {
	return {
		situation: situation,
		message: await translate(messageKey),
		redirectTo: '',
	};
}

/**
 * Reads and immediately clears the `state` cookie.
 *
 * Single-use by construction: whether or not the comparison succeeds, the cookie is gone
 * afterwards, so a `code` cannot be replayed against it.
 */
async function consumeStateCookie(): Promise<StateCookiePayload | null> {
	const cookieName = Configuration.get('oauth.stateCookieName');
	const raw = await getCookie(cookieName);

	await deleteCookie(cookieName);

	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as StateCookiePayload;

		return typeof parsed?.state === 'string' ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Completes social sign-in: verifies `state`, has the backend redeem the code, and turns the
 * resulting token into a session cookie.
 *
 * A server action rather than a route handler because the two failure modes that matter —
 * too many active sessions, and a refused code — need the same on-screen treatment the login
 * form already gives them, which a bare redirect cannot express.
 */
export async function oauthCallbackAction(
	provider: string,
	code: string | null,
	state: string | null,
	providerError: string | null,
): Promise<OAuthCallbackStateType> {
	const stateCookie = await consumeStateCookie();

	// The user pressed "cancel" on the provider's consent screen, or the provider refused.
	if (providerError) {
		return fail('oauth.message.cancelled');
	}

	if (!isOAuthProvider(provider)) {
		return fail('oauth.message.unknown_provider');
	}

	/*
	 * The CSRF check. A missing cookie is as much a failure as a mismatched one: it means
	 * this callback was not preceded by a redirect this app started.
	 */
	if (!state || !stateCookie || stateCookie.state !== state) {
		logger.warn('OAuth callback failed state verification', undefined, {
			provider,
			hasCookie: !!stateCookie,
			hasState: !!state,
		});

		return fail('oauth.message.invalid_state');
	}

	if (!code) {
		return fail('oauth.message.missing_code');
	}

	try {
		const requestResponse = await requestOAuthLogin(
			provider as OAuthProvider,
			code,
			getOAuthRedirectUri(provider),
		);

		if (
			requestResponse?.success &&
			requestResponse.data &&
			'token' in requestResponse.data
		) {
			const authResponse = await createAuth(requestResponse.data.token);

			if (!authResponse?.success) {
				return fail('oauth.message.could_not_sign_in');
			}

			return {
				situation: 'success',
				message: null,
				redirectTo: stateCookie.from,
			};
		}

		// A response without a token is a failure even if the backend flagged success.
		return fail('oauth.message.could_not_sign_in');
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			switch (error.status) {
				case 403: {
					const body = error.body?.data as
						| { authTokens?: AuthTokenType[] }
						| undefined;

					return {
						situation: 'maxActiveSession',
						message: await translate(
							'login.message.max_active_sessions',
						),
						redirectTo: '',
						authTokens: body?.authTokens ?? [],
					};
				}
				case 400:
					// The backend's own message is the useful one here — it distinguishes a
					// spent code from an unverified or withheld provider email.
					return {
						situation: 'error',
						message:
							error.body?.message ??
							(await translate(
								'oauth.message.could_not_sign_in',
							)),
						redirectTo: '',
					};
				case 404:
					return fail('login.message.not_active');
				case 501:
					return fail('oauth.message.provider_unavailable');
				case 502:
					return fail('oauth.message.provider_unreachable');
			}
		}

		logger.error('OAuth callback failed', error);

		return fail('oauth.message.could_not_sign_in');
	}
}
