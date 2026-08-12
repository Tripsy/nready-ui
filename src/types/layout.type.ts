export const LAYOUT_TRANSLATION_KEYS = [
	'layout.nav.home',
	'layout.nav.dashboard',
	'layout.nav.driver_panel',
	'layout.menu.login',
	'layout.menu.login_title',
	'layout.menu.register',
	'layout.menu.register_title',
	'layout.menu.account',
	'layout.menu.dashboard',
	'layout.menu.logout',
	'layout.aria.toggle_menu',
	'layout.aria.toggle_theme',
	'layout.aria.switch_language',
	'layout.aria.loading_page',
	'layout.aria.account_error',
] as const;

export type LayoutTranslations = Record<
	(typeof LAYOUT_TRANSLATION_KEYS)[number],
	string
>;
