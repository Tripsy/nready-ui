import { type NextRequest, NextResponse } from 'next/server';
import type {
	OAuthCallbackSituationType,
	OAuthCallbackStateType,
} from '@/app/(public)/account/oauth/[provider]/oauth-callback.definition';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { logger } from '@/helpers/logger.helper';
import {
	deleteCookie,
	getCookie,
	writeSessionCookie,
} from '@/helpers/session.helper';
import { requestOAuthLogin } from '@/services/account.service';
import type { AuthTokenType } from '@/types/auth.type';
import {
	getOAuthRedirectUri,
	isOAuthProvider,
	type OAuthProvider,
} from '@/types/oauth.type';

/**
 * Completes social sign-in: verifies `state`, has the backend redeem the code, and turns the
 * resulting token into a session cookie.
 *
 * A route handler, not a server action. The callback component holds the outcome in `useState`
 * and guards the single-use `code` with a `useRef`; an action's response re-renders the page it
 * was posted to, which resets both — dropping the result and re-arming the redeem guard so the
 * already-spent code is exchanged a second time. A route handler answers with plain JSON, so
 * the component keeps what it is holding.
 *
 * Still server-side, which is what the flow needs: the `state` cookie is httpOnly and must be
 * read and cleared where the browser cannot. Being a mutating request under `/api/`, it also
 * passes the middleware's CSRF gate — the client fetch carries the header, so the reason the
 * old action gave for skipping that gate no longer applies.
 */

type StateCookiePayload = {
	state: string;
	from: string;
};

async function fail(
	messageKey: string,
	situation: OAuthCallbackSituationType = 'error',
): Promise<NextResponse<OAuthCallbackStateType>> {
	return NextResponse.json({
		situation: situation,
		message: await translate(messageKey),
		redirectTo: '',
	});
}

/**
 * Reads and immediately clears the `state` cookie.
 *
 * Single-use by construction: whether the comparison succeeds, the cookie is gone
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

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse<OAuthCallbackStateType>> {
	const { provider } = await params;

	let code: string | null = null;
	let state: string | null = null;
	let providerError: string | null = null;

	try {
		({
			code = null,
			state = null,
			providerError = null,
		} = await request.json());
	} catch {
		// Leave all three null — the checks below report it as a failed callback.
	}

	const stateCookie = await consumeStateCookie();

	// The user pressed "cancel" on the provider's consent screen, or the provider refused.
	if (providerError) {
		return fail('oauth.message.cancelled');
	}

	if (!isOAuthProvider(provider)) {
		return fail('oauth.message.unknown_provider');
	}

	/*
	 * The CSRF check for the provider round trip. A missing cookie is as much a failure as a
	 * mismatched one: it means this callback was not preceded by a redirect this app started.
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
			await writeSessionCookie(requestResponse.data.token);

			return NextResponse.json({
				situation: 'success' as const,
				message: null,
				redirectTo: stateCookie.from,
			});
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

					return NextResponse.json({
						situation: 'maxActiveSession' as const,
						message: await translate(
							'login.message.max_active_sessions',
						),
						redirectTo: '',
						authTokens: body?.authTokens ?? [],
					});
				}
				case 400:
					// The backend's own message is the useful one here — it distinguishes a
					// spent code from an unverified or withheld provider email.
					return NextResponse.json({
						situation: 'error' as const,
						message:
							error.body?.message ??
							(await translate(
								'oauth.message.could_not_sign_in',
							)),
						redirectTo: '',
					});
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
