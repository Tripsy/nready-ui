import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';
import { getObjectValue } from '@/helpers/objects.helper';
import { replaceVars } from '@/helpers/string.helper';
import type { Language } from '@/types/common.type';

type TranslationValue = string | { [key: string]: TranslationValue };
type TranslationResource = Record<string, TranslationValue>;

/** Resolved resources, readable synchronously by `translateLoaded`. */
const languageResources: Record<string, TranslationResource> = {};

/**
 * In-flight imports, so concurrent first callers share one `import()` rather than each
 * starting their own — `languageResources` is only populated once the import resolves.
 */
const languageResourcesPending: Record<
	string,
	Promise<TranslationResource>
> = {};

const isDebug = Configuration.get('app.debug');

async function fetchLanguage(): Promise<Language> {
	const fallback = Configuration.defaultLanguage();

	try {
		const { headers } = await import('next/headers');
		const headerStore = await headers();

		const fromHeader = headerStore.get('x-language')?.trim().toLowerCase();

		if (fromHeader && Configuration.isSupportedLanguage(fromHeader)) {
			return fromHeader as Language;
		}
	} catch (error) {
		// Not an error worth shouting about: `headers()` throws whenever it is called
		// outside a request scope, and falling back to the default language is correct.
		logger.debug('Could not read the language header', error);
	}

	return fallback;
}

export function getLanguageClient(): Language {
	// Client: read from html[lang] set by RootLayout — always fresh
	const fromDom = document.documentElement.lang?.toLowerCase();

	if (fromDom && Configuration.isSupportedLanguage(fromDom)) {
		return fromDom as Language;
	}

	return Configuration.defaultLanguage();
}

export async function getLanguage(): Promise<Language> {
	if (typeof document !== 'undefined') {
		return getLanguageClient();
	}

	return fetchLanguage();
}

function loadLanguageResource(language: string): Promise<TranslationResource> {
	const loaded = languageResources[language];

	if (loaded) {
		return Promise.resolve(loaded);
	}

	languageResourcesPending[language] ??= import(`@/locales/${language}`).then(
		(module) => {
			languageResources[language] = module.default;

			return module.default;
		},
	);

	return languageResourcesPending[language];
}

/**
 * Utility function used to get the translated string from the resource.
 * Always returns `string` (Note: if the returned object value is not string, it returns the key)
 */
export const getTranslatedString = (
	resource: TranslationResource,
	key: string,
) => {
	const objectValue = getObjectValue(resource, key);

	if (typeof objectValue === 'string') {
		return objectValue;
	}

	// A miss is silent in production — the key is a serviceable placeholder and warning on
	// every render would be noise — but while developing it is almost always a typo or a
	// key that was never added to the locale file.
	if (isDebug) {
		logger.warn('Missing translation', undefined, { key });
	}

	return key;
};

/**
 * Synchronous lookup for a key whose locale resource is already in the module cache.
 *
 * `translate` is async purely because the locale bundle is a dynamic import — once that
 * import has resolved the lookup itself is pure. Client components use this to paint the
 * right text on their first frame instead of flashing empty for a tick.
 *
 * Returns `null` when the resource has not been loaded yet (or on the server), so callers
 * fall back to the async path.
 */
export const translateLoaded = (
	key: string,
	replacements: Record<string, string | number> = {},
): string | null => {
	if (typeof document === 'undefined') {
		return null;
	}

	const languageResource = languageResources[getLanguageClient()];

	if (!languageResource) {
		return null;
	}

	const value = getTranslatedString(languageResource, key);

	if (value !== key && replacements) {
		return replaceVars(value, replacements);
	}

	return value;
};

/**
 * Translate a key with optional replacements.
 * The key should be in the format `namespace.key`.
 */
export const translate = async (
	key: string,
	replacements: Record<string, string | number> = {},
): Promise<string> => {
	const languageSelected = await getLanguage();
	const languageResource = await loadLanguageResource(languageSelected);

	const value = getTranslatedString(languageResource, key);

	if (value !== key && replacements) {
		return replaceVars(value, replacements);
	}

	return value;
};

export type TranslateKey<T> = T extends string
	? T
	: T extends { key: infer K }
		? K extends string
			? K
			: never
		: never;

/**
 * Translate multiple keys with optional replacements.
 *
 * @example translateBatch([
 *     { key: "user.create" },
 *     { key: "user.edit", vars: { "user.id": 1 } },
 *     { key: "user.delete" }
 * ])
 */
export const translateBatch = async <
	const T extends readonly (
		| string
		| { key: string; vars?: Record<string, string | number> }
	)[],
>(
	requests: T,
	keyPrefix?: string,
): Promise<Record<TranslateKey<T[number]>, string>> => {
	const language = await getLanguage();
	const resource = await loadLanguageResource(language);

	const result: Record<string, string> = {};

	for (const request of requests) {
		if (typeof request === 'string') {
			const requestKey = keyPrefix ? `${keyPrefix}.${request}` : request;

			result[request] = getTranslatedString(resource, requestKey);
		} else {
			const requestKey = keyPrefix
				? `${keyPrefix}.${request.key}`
				: request.key;
			const value = getTranslatedString(resource, requestKey);

			if (request.vars) {
				result[request.key] = replaceVars(value, request.vars);
			} else {
				result[request.key] = value;
			}
		}
	}

	return result;
};

// export async function getLocaleValue<T>(key: string): Promise<T | undefined> {
// 	const language = await getLanguage();
// 	const resource = await loadLanguageResource(language);
//
// 	const value = getObjectValue(resource, key);
//
// 	return value as T | undefined;
// }
