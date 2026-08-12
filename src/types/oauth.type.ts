import { Configuration } from '@/config/settings.config';

export const OAuthProviderEnum = {
	GOOGLE: 'google',
	FACEBOOK: 'facebook',
} as const;

export type OAuthProvider =
	(typeof OAuthProviderEnum)[keyof typeof OAuthProviderEnum];

/** Shape of a linked provider as returned by `GET /account/oauth`. */
export type OAuthIdentityType = {
	provider: OAuthProvider;
	email: string | null;
	last_login_at: Date | string | null;
};

export const OAUTH_PROVIDER_LABEL: Record<OAuthProvider, string> = {
	[OAuthProviderEnum.GOOGLE]: 'Google',
	[OAuthProviderEnum.FACEBOOK]: 'Facebook',
};

export function isOAuthProvider(value: string): value is OAuthProvider {
	return Object.values(OAuthProviderEnum).includes(value as OAuthProvider);
}

/**
 * A provider is offered only when this app knows its client id. The backend enforces the
 * real gate (it holds the secret and answers 501 without one) — this just avoids showing a
 * button that could only ever fail.
 */
export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
	return Configuration.get(`oauth.${provider}.clientId`) !== '';
}

export function getEnabledOAuthProviders(): OAuthProvider[] {
	return Object.values(OAuthProviderEnum).filter(isOAuthProviderEnabled);
}

/**
 * Where the provider sends the browser back to. It has to match byte-for-byte between the
 * authorize request and the backend's token exchange — the provider compares them — so both
 * legs are built from this one function.
 */
export function getOAuthRedirectUri(provider: OAuthProvider): string {
	return `${Configuration.get('app.url')}/account/oauth/${provider}`;
}

/**
 * Builds the provider's authorize URL.
 *
 * `state` is the CSRF guard: it is minted alongside a cookie before the redirect and has to
 * come back unchanged, which is what stops an attacker feeding their own `code` into a
 * victim's session. The backend cannot check it — it never sees the browser leave — so this
 * is the only place it is enforced.
 */
export function buildOAuthAuthorizeUrl(
	provider: OAuthProvider,
	state: string,
): string {
	const redirectUri = getOAuthRedirectUri(provider);

	switch (provider) {
		case OAuthProviderEnum.GOOGLE: {
			const params = new URLSearchParams({
				client_id: Configuration.get('oauth.google.clientId'),
				redirect_uri: redirectUri,
				response_type: 'code',
				// `openid` is what makes Google return an id_token, which is where the
				// backend reads the subject id and the verified email from.
				scope: 'openid email profile',
				state: state,
				// Without these a returning user is silently re-authorised and never gets
				// the chance to pick a different account.
				prompt: 'select_account',
			});

			return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
		}
		case OAuthProviderEnum.FACEBOOK: {
			const params = new URLSearchParams({
				client_id: Configuration.get('oauth.facebook.clientId'),
				redirect_uri: redirectUri,
				response_type: 'code',
				scope: 'email public_profile',
				state: state,
			});

			return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
		}
	}
}
