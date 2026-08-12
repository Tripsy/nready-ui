import type { AuthTokenType } from '@/types/auth.type';

export const OAUTH_CALLBACK_TRANSLATION_KEYS = [
	'app.error.title',
	'app.success.title',
	'oauth.form.title_signing_in',
	'oauth.form.title_max_sessions',
	'oauth.form.title_failed',
	'oauth.link.session_freed_prompt',
	'oauth.link.sign_in_again',
	'oauth.link.back_to_login',
	'oauth.value.provider_fallback',
	'login.message.session_destroy_success',
	'login.message.session_destroy_error',
] as const;

export type OAuthCallbackTranslations = Record<
	(typeof OAUTH_CALLBACK_TRANSLATION_KEYS)[number],
	string
>;

export type OAuthCallbackSituationType =
	| 'pending'
	| 'success'
	| 'error'
	| 'maxActiveSession';

export type OAuthCallbackStateType = {
	situation: OAuthCallbackSituationType;
	message: string | null;
	/** Where to send the user once the session exists; empty means "home". */
	redirectTo: string;
	/** Present only in the `maxActiveSession` case, so a session can be revoked. */
	authTokens?: AuthTokenType[];
};

export const OAuthCallbackState: OAuthCallbackStateType = {
	situation: 'pending',
	message: null,
	redirectTo: '',
};
