import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { translateBatch, translateLoaded } from '@/config/translate.setup';
import { logger } from '@/helpers/logger.helper';

/**
 * NUL is used to join the keys because it cannot occur in a translation key, so the joined
 * string is a faithful stand-in for the array's contents.
 */
const KEY_SEPARATOR = '\u0000';

function splitKeys(joined: string): string[] {
	return joined ? joined.split(KEY_SEPARATOR) : [];
}

export function useTranslation<const T extends readonly string[]>(keys: T) {
	type TranslationMap = Record<T[number], string>;

	type TranslationState = {
		translations: TranslationMap;
		isLoading: boolean;
	};

	const [state, setState] = useState<TranslationState>({
		translations: {} as TranslationMap,
		isLoading: true,
	});

	/*
	 * The effects key on the *contents* of `keys`, not the array's identity. Depending on
	 * the array itself would re-run them for any caller that builds it inline — each run
	 * setting state, re-rendering, and rebuilding the array again, without end. Callers are
	 * therefore free to pass a literal; wrapping it in `useMemo` is no longer load-bearing.
	 */
	const keysKey = keys.join(KEY_SEPARATOR);

	// Set by the layout effect and read by the async effect below, which React runs after
	// it for the same commit.
	const isSeededRef = useRef(false);

	/*
	 * Fill in from the already-loaded locale resource before the browser paints, so a
	 * consumer doesn't render one empty frame on every client-side navigation.
	 *
	 * Deliberately a layout effect rather than a `useState` initializer: seeding during
	 * render would make the client's first pass disagree with the server HTML (which can
	 * never have the resource) and trip a hydration mismatch. On the very first load the
	 * cache is cold, so this is a no-op and the async effect below still does the work.
	 */
	useLayoutEffect(() => {
		isSeededRef.current = false;

		const seeded = {} as Record<string, string>;

		for (const key of splitKeys(keysKey)) {
			const value = translateLoaded(key);

			if (value === null) {
				return;
			}

			seeded[key] = value;
		}

		isSeededRef.current = true;

		setState({ translations: seeded as TranslationMap, isLoading: false });
	}, [keysKey]);

	useEffect(() => {
		/*
		 * The layout effect resolved every key from the loaded resource. The async path
		 * reads that same cache, so it can only arrive at identical values — running it
		 * would cost each consumer an extra render, and a fresh `translations` identity,
		 * for nothing.
		 */
		if (isSeededRef.current) {
			return;
		}

		let isMounted = true;

		(async () => {
			try {
				// One pass for the whole set: `translateBatch` resolves the language and
				// loads the resource once, where a `translate` per key repeats both.
				const translations = await translateBatch(splitKeys(keysKey));

				if (!isMounted) {
					return;
				}

				setState({
					translations: translations as TranslationMap,
					isLoading: false,
				});
			} catch (error) {
				logger.error('Failed to load translations', error);

				if (isMounted) {
					setState((prev) => ({ ...prev, isLoading: false }));
				}
			}
		})();

		return () => {
			isMounted = false;
		};
	}, [keysKey]);

	return {
		translations: state.translations,
		isTranslationLoading: state.isLoading,
	};
}
