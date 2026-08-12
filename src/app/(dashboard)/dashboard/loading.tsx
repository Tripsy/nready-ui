import { Skeleton } from '@/components/ui/skeleton';

// Static ids instead of array indexes so the keys are stable and lint-clean.
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Suspense fallback shared by every dashboard route.
 *
 * Without it the App Router holds the previous page on screen for the entire RSC
 * round-trip, so a menu click looks like the UI froze. With it, the layout (header +
 * side menu) stays put and only the content area swaps to this placeholder as soon as
 * the server flushes the shell.
 *
 * Shaped like the shared data-table shell (filters → actions → rows), which is what
 * nearly every dashboard route renders.
 */
export default function Loading() {
	return (
		<div className="table-container" aria-busy="true" aria-live="polite">
			<div className="flex flex-wrap gap-3 mb-4">
				<Skeleton className="h-10 w-full max-w-xs" />
				<Skeleton className="h-10 w-40" />
				<Skeleton className="h-10 w-40" />
			</div>

			<div className="flex items-center justify-between mb-4">
				<Skeleton className="h-9 w-32" />
				<Skeleton className="h-9 w-24" />
			</div>

			<div className="flex flex-col gap-2">
				<Skeleton className="h-11 w-full" />
				{SKELETON_ROWS.map((row) => (
					<Skeleton
						key={`skeleton-row-${row}`}
						className="h-14 w-full"
					/>
				))}
			</div>

			<div className="flex justify-center mt-4">
				<Skeleton className="h-9 w-64" />
			</div>
		</div>
	);
}
