import { LoadingIcon } from '@/components/status.component';

/**
 * Suspense fallback shared by every public route, so a navigation shows movement instead
 * of holding the previous page until the RSC payload lands.
 *
 * Intentionally text-free: a Suspense fallback may not suspend, so it cannot `await
 * translate(...)`, and hard-coded English would leak into the other locales.
 */
export default function Loading() {
	return (
		// `output` carries an implicit role="status" (and aria-live="polite"), which a bare
		// div cannot support aria-label on.
		<output
			className="min-h-[60vh] flex items-center justify-center px-4 py-12"
			aria-busy="true"
			aria-label="Loading"
		>
			<LoadingIcon className="w-12 h-12 text-warning bg-warning/10 rounded-full p-3" />
		</output>
	);
}
