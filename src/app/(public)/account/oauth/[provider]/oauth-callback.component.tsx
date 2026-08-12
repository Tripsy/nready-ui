'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AuthTokenList } from '@/app/(public)/_components/auth-token-list.component';
import { oauthCallbackAction } from '@/app/(public)/account/oauth/[provider]/oauth-callback.action';
import {
	OAuthCallbackState,
	type OAuthCallbackStateType,
	type OAuthCallbackTranslations,
} from '@/app/(public)/account/oauth/[provider]/oauth-callback.definition';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import Routes, { isExcludedRoute } from '@/config/routes.setup';
import { replaceVars } from '@/helpers/string.helper';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import { OAUTH_PROVIDER_LABEL, type OAuthProvider } from '@/types/oauth.type';

type OAuthCallbackProps = {
	provider: string;
	code: string | null;
	state: string | null;
	providerError: string | null;
	translations: OAuthCallbackTranslations;
};

export default function OAuthCallback({
	provider,
	code,
	state,
	providerError,
	translations,
}: OAuthCallbackProps) {
	const router = useRouter();
	const { refreshAuth } = useAuth();
	const { showToast } = useToast();

	const [result, setResult] =
		useState<OAuthCallbackStateType>(OAuthCallbackState);

	/*
	 * The authorization code is single-use — the provider rejects a second exchange. React
	 * Strict Mode runs effects twice in development, so without this guard the first attempt
	 * consumes the code and the second reports a failure over an already-successful sign-in.
	 */
	const redeemed = useRef(false);

	useEffect(() => {
		if (redeemed.current) {
			return;
		}

		redeemed.current = true;

		(async () => {
			setResult(
				await oauthCallbackAction(provider, code, state, providerError),
			);
		})();
	}, [provider, code, state, providerError]);

	useEffect(() => {
		if (result.situation !== 'success') {
			return;
		}

		(async () => {
			await refreshAuth();

			let redirectUrl = Routes.get('home');

			if (result.redirectTo) {
				const url = new URL(result.redirectTo, window.location.origin);

				if (!isExcludedRoute(url.pathname)) {
					redirectUrl = url.toString();
				}
			}

			router.replace(redirectUrl);
		})();
	}, [result, router, refreshAuth]);

	const providerLabel =
		OAUTH_PROVIDER_LABEL[provider as OAuthProvider] ??
		translations['oauth.value.provider_fallback'];

	if (result.situation === 'pending' || result.situation === 'success') {
		return (
			<LoadingComponent
				title={replaceVars(
					translations['oauth.form.title_signing_in'],
					{
						provider: providerLabel,
					},
				)}
			/>
		);
	}

	if (result.situation === 'maxActiveSession') {
		return (
			<ErrorComponent
				title={translations['oauth.form.title_max_sessions']}
				description={result.message as string}
			>
				<div className="mt-6">
					<AuthTokenList
						tokens={result.authTokens ?? []}
						onResult={(success, message) => {
							showToast({
								severity: success ? 'success' : 'error',
								summary: success
									? translations['app.success.title']
									: translations['app.error.title'],
								detail:
									message === 'session_destroy_success'
										? translations[
												'login.message.session_destroy_success'
											]
										: translations[
												'login.message.session_destroy_error'
											],
							});
						}}
					/>

					<p className="text-sm text-muted text-center mt-6">
						{translations['oauth.link.session_freed_prompt']}{' '}
						<Link
							href={Routes.get('login')}
							className="text-accent font-medium hover:underline"
						>
							{translations['oauth.link.sign_in_again']}
						</Link>
					</p>
				</div>
			</ErrorComponent>
		);
	}

	return (
		<ErrorComponent
			title={translations['oauth.form.title_failed']}
			description={result.message as string}
		>
			<p className="text-sm text-muted text-center mt-6">
				<Link
					href={Routes.get('login')}
					className="text-accent font-medium hover:underline"
				>
					{translations['oauth.link.back_to_login']}
				</Link>
			</p>
		</ErrorComponent>
	);
}
