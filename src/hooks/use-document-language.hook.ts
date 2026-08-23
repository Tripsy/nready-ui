'use client';

import { useSyncExternalStore } from 'react';

/**
 * The language currently in effect, as a reactive value.
 *
 * `RootLayout` renders the resolved language onto `html[lang]` and `router.refresh()` patches
 * that attribute when the switcher changes it — the same source `getLanguageClient()` reads. So
 * the attribute, not a store or a cookie, is what tells a client component the language moved.
 *
 * Consumers use it to re-resolve text they resolved earlier: a translated string held in state
 * cannot follow a language change on its own.
 */

function subscribe(onStoreChange: () => void): () => void {
	const observer = new MutationObserver(onStoreChange);

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['lang'],
	});

	return () => observer.disconnect();
}

function getSnapshot(): string {
	return document.documentElement.lang;
}

/*
 * There is no `html[lang]` to read while rendering on the server, and returning a guess would
 * make the hydration pass disagree with the markup. The empty string stands for "not known
 * yet"; callers must treat it as such rather than as a language change.
 */
function getServerSnapshot(): string {
	return '';
}

export function useDocumentLanguage(): string {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
