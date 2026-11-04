'use client';

import { useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';
import type { JSX } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type ResponseStatsRecentCounts,
	requestStatsRecentCounts,
} from '@/services/stats.service';

const TRANSLATION_KEYS = [
	'dashboard.text.could_not_retrieve_counts',
	'dashboard.text.failed_to_retrieve_counts',
	'dashboard.labels.user',
	'dashboard.labels.client',
	'dashboard.labels.article',
	'dashboard.labels.comment',
	'dashboard.labels.complaint',
] as const;

/**
 * Keyed by the response field, so a missing entry is a type error rather than a silent zero.
 * The key doubles as the dashboard route key - they happen to agree for all five.
 */
const COUNT_ITEMS: ReadonlyArray<keyof ResponseStatsRecentCounts> = [
	'user',
	'client',
	'article',
	'comment',
	'complaint',
];

export function RecentCounts(): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'recent-counts'],
		queryFn: () => requestStatsRecentCounts(),
		// Matches the backend's own cache window for this endpoint.
		staleTime: 20 * 60 * 1000,
	});

	if (isLoading) {
		return (
			<div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
				{COUNT_ITEMS.map((key) => (
					<div key={key} className="space-y-2">
						<Skeleton className="h-7 w-10" />
						<Skeleton className="h-3 w-16" />
					</div>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<div className="text-danger">
				{translations['dashboard.text.failed_to_retrieve_counts']}
			</div>
		);
	}

	if (!data) {
		return (
			<div className="text-muted">
				{translations['dashboard.text.could_not_retrieve_counts']}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
			{COUNT_ITEMS.map((key) => (
				<NextLink
					key={key}
					href={Routes.get(key)}
					className="rounded-md transition-colors hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-focus"
				>
					{/* Zero is the common case on a quiet day - muted so the eye goes to the
					    counts that actually moved. */}
					<div
						className={cn(
							'text-2xl font-bold',
							data[key] === 0 && 'text-muted',
						)}
					>
						{data[key]}
					</div>
					<div className="text-xs text-muted">
						{translations[`dashboard.labels.${key}`]}
					</div>
				</NextLink>
			))}
		</div>
	);
}
