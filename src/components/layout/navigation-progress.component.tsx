'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Safety net: if a navigation is cancelled or blocked (middleware redirect loop, aborted
// fetch) the pathname never changes, so drop the bar instead of animating forever.
const MAX_VISIBLE_MS = 15_000;

/**
 * Global navigation feedback bar.
 *
 * The App Router exposes no router-event API, and a soft navigation keeps the previous
 * page on screen for the whole RSC round-trip — which reads as a frozen UI. So the bar is
 * started from the click itself (capture phase, before Next handles it) and stopped when
 * `usePathname()` reports the new URL has committed.
 *
 * Trade-off: this covers anchor navigation only, not programmatic `router.push()`.
 * Catching those would mean wrapping/patching the router, which is far more invasive than
 * the handful of push call-sites justify — those are mostly post-submit redirects that
 * already show their own pending state.
 *
 * The animation is deliberately indeterminate: we cannot know real progress, and faking a
 * percentage is worse than admitting it.
 */
type NavigationProgressProps = {
	/**
	 * Resolved in the root layout: this renders above the locale-aware public layout and
	 * has no request scope of its own to `translate()` from.
	 */
	label: string;
};

export function NavigationProgress({ label }: NavigationProgressProps) {
	const pathname = usePathname();
	const [isNavigating, setIsNavigating] = useState(false);

	// The new route committed (or the user navigated back) — we are done.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not an input. Dropping it would run this once on mount and the bar would never clear.
	useEffect(() => {
		setIsNavigating(false);
	}, [pathname]);

	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			// Let modified clicks (new tab/window, download) and already-handled clicks pass.
			if (event.defaultPrevented || event.button !== 0) {
				return;
			}

			if (
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}

			const anchor = (event.target as HTMLElement | null)?.closest('a');

			if (
				!anchor ||
				anchor.target === '_blank' ||
				anchor.hasAttribute('download')
			) {
				return;
			}

			const href = anchor.getAttribute('href');

			if (!href) {
				return;
			}

			const target = new URL(anchor.href, window.location.href);

			// External links leave the app; same-document links (hash, identical URL) never
			// hit the server — neither produces a loading state worth showing.
			if (target.origin !== window.location.origin) {
				return;
			}

			if (
				target.pathname === window.location.pathname &&
				target.search === window.location.search
			) {
				return;
			}

			setIsNavigating(true);
		};

		document.addEventListener('click', handleClick, { capture: true });

		return () =>
			document.removeEventListener('click', handleClick, {
				capture: true,
			});
	}, []);

	useEffect(() => {
		if (!isNavigating) {
			return;
		}

		const timer = setTimeout(() => setIsNavigating(false), MAX_VISIBLE_MS);

		return () => clearTimeout(timer);
	}, [isNavigating]);

	if (!isNavigating) {
		return null;
	}

	return (
		// `output` already means role="status" + aria-live="polite"; spelling them out on a
		// div is what the semantic-elements rule flags.
		<output className="navigation-progress" aria-label={label}>
			<div className="navigation-progress-bar" />
		</output>
	);
}
