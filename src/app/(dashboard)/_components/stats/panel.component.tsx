'use client';

import type { JSX, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * What a tabbed panel hands back to the card hosting it. `count` is how many rows the current
 * filter selected — the tab strip badges it, which is why every tab's query runs even while
 * its own panel is hidden.
 */
export type PanelView = {
	count: number;
	/** Whether the current filter actually selects failures, which decides the badge colour. */
	isAlert: boolean;
	/** Kept apart from `body` so the host can add its own controls to the filter row. */
	filters: ReactNode;
	body: ReactNode;
};

/**
 * Shared shell for the dashboard's list panels (log data, mail queue, cron history). They differ
 * only in what a row says, so the loading / error / empty handling and the row frame live here
 * and each panel supplies its own row content.
 */

function PanelSkeleton({ rows = 4 }: { rows?: number }): JSX.Element {
	const items = Array.from({ length: rows }, (_, i) => ({ id: `row-${i}` }));

	return (
		<div className="space-y-4">
			{items.map((v) => (
				<div
					key={v.id}
					className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0"
				>
					<div className="space-y-2">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-3 w-24" />
					</div>
					<Skeleton className="h-3 w-16" />
				</div>
			))}
		</div>
	);
}

export function PanelBody({
	isLoading,
	isError,
	isEmpty,
	errorText,
	emptyText,
	children,
}: {
	isLoading: boolean;
	isError: boolean;
	isEmpty: boolean;
	errorText: string;
	emptyText: string;
	children: ReactNode;
}): JSX.Element {
	if (isLoading) {
		return <PanelSkeleton />;
	}

	if (isError) {
		return <div className="text-danger">{errorText}</div>;
	}

	if (isEmpty) {
		return <div className="text-muted">{emptyText}</div>;
	}

	return <div className="space-y-4">{children}</div>;
}

export function PanelRow({
	aside,
	children,
}: {
	/** Right-hand column, kept on one line — in practice the relative timestamp. */
	aside: ReactNode;
	children: ReactNode;
}): JSX.Element {
	return (
		<div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
			{/* `min-w-0` lets the child's `truncate` engage — without it the flex item
			    refuses to shrink below its content and the row overflows the card. */}
			<div className="min-w-0">{children}</div>
			<span className="text-sm text-muted whitespace-nowrap">
				{aside}
			</span>
		</div>
	);
}

/** Filter row above a panel's list. */
export function PanelFilters({
	children,
	trailing,
}: {
	children: ReactNode;
	/** Right-aligned slot for the host's own controls, level with the filter inputs. */
	trailing?: ReactNode;
}): JSX.Element {
	return (
		<div className="flex flex-row flex-wrap items-end justify-between gap-4 mb-4">
			<div className="flex flex-row flex-wrap gap-4">{children}</div>
			{trailing}
		</div>
	);
}
