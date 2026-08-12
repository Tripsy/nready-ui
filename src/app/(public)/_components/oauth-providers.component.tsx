'use client';

import { useSearchParams } from 'next/navigation';
import Routes from '@/config/routes.setup';
import { replaceVars } from '@/helpers/string.helper';
import {
	getEnabledOAuthProviders,
	OAUTH_PROVIDER_LABEL,
	type OAuthProvider,
	OAuthProviderEnum,
} from '@/types/oauth.type';

function GoogleMark() {
	return (
		<svg
			className="w-5 h-5"
			viewBox="0 0 48 48"
			aria-hidden="true"
			focusable="false"
		>
			<path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
			/>
			<path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
			/>
			<path
				fill="#FBBC05"
				d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
			/>
			<path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
			/>
		</svg>
	);
}

function FacebookMark() {
	return (
		<svg
			className="w-5 h-5"
			viewBox="0 0 24 24"
			aria-hidden="true"
			focusable="false"
		>
			<path
				fill="#1877F2"
				d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
			/>
		</svg>
	);
}

const PROVIDER_MARK: Record<OAuthProvider, () => React.JSX.Element> = {
	[OAuthProviderEnum.GOOGLE]: GoogleMark,
	[OAuthProviderEnum.FACEBOOK]: FacebookMark,
};

/**
 * Social sign-in buttons for the login and register screens.
 *
 * Deliberately plain links, not buttons with an onClick: the browser has to navigate to the
 * provider, and `/api/oauth/:provider` needs to set the `state` cookie on the way out. That
 * only works as a real navigation.
 *
 * Renders nothing when no provider is configured, so a deployment without OAuth credentials
 * shows an unchanged login form rather than dead buttons.
 */
type OAuthProvidersProps = {
	/** Divider caption, e.g. "or continue with". */
	label: string;
	/** Button caption carrying a `{{provider}}` placeholder. */
	continueWith: string;
};

export function OAuthProviders({ label, continueWith }: OAuthProvidersProps) {
	const searchParams = useSearchParams();
	const providers = getEnabledOAuthProviders();

	if (providers.length === 0) {
		return null;
	}

	// Preserve the post-login destination the guard put on the login URL.
	const from = searchParams.get('from');

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-border" />
				<span className="text-xs uppercase tracking-wide text-muted">
					{label}
				</span>
				<span className="h-px flex-1 bg-border" />
			</div>

			<div className="grid gap-3">
				{providers.map((provider) => {
					const Mark = PROVIDER_MARK[provider];
					const href = `${Routes.get('oauth-start', { provider })}${
						from ? `?from=${encodeURIComponent(from)}` : ''
					}`;

					return (
						<a
							key={provider}
							href={href}
							className="flex items-center justify-center gap-3 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface/70 transition-colors"
						>
							<Mark />
							{replaceVars(continueWith, {
								provider: OAUTH_PROVIDER_LABEL[provider],
							})}
						</a>
					);
				})}
			</div>
		</div>
	);
}
