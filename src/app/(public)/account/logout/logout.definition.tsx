export const LOGOUT_TRANSLATION_KEYS = [
	'logout.form.title',
	'logout.message.loading_description',
	'logout.message.error_description',
	'logout.message.success_description',
	'logout.link.what_next',
	'logout.link.go_back_prompt',
	'logout.link.login',
	'logout.link.or_navigate',
	'logout.link.home',
] as const;

export type LogoutTranslations = Record<
	(typeof LOGOUT_TRANSLATION_KEYS)[number],
	string
>;

export type LogoutSituation = 'success' | 'error' | null;

export type LogoutState = {
	message: string | null;
	situation: LogoutSituation;
};

export const LogoutDefaultState: LogoutState = {
	message: null,
	situation: null,
};
