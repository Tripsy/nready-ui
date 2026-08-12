import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import Routes, { isExcludedRoute } from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';
import {
	buildOAuthAuthorizeUrl,
	isOAuthProvider,
	isOAuthProviderEnabled,
} from '@/types/oauth.type';

/**
 * Starts the social sign-in redirect.
 *
 * A route handler rather than a server action so the button can stay a plain `<a>`: the
 * browser has to *navigate* to the provider, and a fetch-based action would only give us a
 * URL to assign afterwards, adding a hop and a broken no-JS path for nothing.
 *
 * The `state` is minted here and stored in an httpOnly cookie. The callback compares the two
 * and refuses on a mismatch — the backend cannot do this check, since it never sees the
 * browser leave, so this handler and the callback are jointly the entire CSRF defence for
 * the flow.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
	const { provider } = await params;

	if (!isOAuthProvider(provider) || !isOAuthProviderEnabled(provider)) {
		logger.warn('Rejected OAuth start for unknown provider', undefined, {
			provider,
		});

		return NextResponse.redirect(
			new URL(
				`${Routes.get('login')}?oauth_error=provider`,
				Configuration.get('app.url'),
			),
		);
	}

	const state = uuid();

	/*
	 * Where to land after a successful sign-in. Carried in the cookie rather than through
	 * the provider's `state`, so the value never leaves this origin — a redirect target that
	 * round-trips through a third party is a redirect target an attacker can rewrite.
	 */
	const fromParam = request.nextUrl.searchParams.get('from');
	const from = fromParam && isSafeReturnPath(fromParam) ? fromParam : '';

	const response = NextResponse.redirect(
		buildOAuthAuthorizeUrl(provider, state),
	);

	const cookieMaxAge = Configuration.get('oauth.stateCookieMaxAge');

	response.cookies.set(
		Configuration.get('oauth.stateCookieName'),
		JSON.stringify({ state, from }),
		{
			httpOnly: true,
			secure: Configuration.isEnvironment('production'),
			path: '/',
			// Must not be 'strict': the request coming back is a cross-site navigation from
			// the provider, and a strict cookie would simply not be sent with it.
			sameSite: 'lax',
			maxAge: cookieMaxAge,
		},
	);

	return response;
}

/**
 * Only same-origin, non-auth paths are accepted as a return target — an absolute URL here
 * would make this an open redirect.
 */
function isSafeReturnPath(value: string): boolean {
	if (!value.startsWith('/') || value.startsWith('//')) {
		return false;
	}

	return !isExcludedRoute(value.split('?')[0]);
}

export const dynamic = 'force-dynamic';
