'use client';

import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icon.component';
import { Skeleton } from '@/components/ui/skeleton';
import { displayWorkSessionDuration } from '@/models/work-session.model';
import { requestStatsActiveWorkSessions } from '@/services/stats.service';

function ActiveWorkSessionsSkeleton() {
	const items = Array.from({ length: 3 }, (_, i) => ({
		id: `wh-${i}`,
	}));

	return (
		<div className="space-y-4">
			{items.map((v) => (
				<div key={v.id} className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-4 w-32" />
					</div>
					<div className="flex items-center gap-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-4 w-4" />
					</div>
				</div>
			))}
		</div>
	);
}

export function ActiveWorkSessions() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'active-work-sessions'],
		queryFn: () => requestStatsActiveWorkSessions(),
		staleTime: 20 * 60 * 1000,
	});

	if (isLoading) {
		return <ActiveWorkSessionsSkeleton />;
	}

	if (isError) {
		return (
			<div className="text-danger">
				Failed to load active work sessions
			</div>
		);
	}

	if (!data || data.length === 0) {
		return <div className="text-muted">No active work sessions found</div>;
	}

	return (
		<div className="space-y-4">
			{data.map((entry) => (
				<div
					key={entry.id}
					className="flex items-center justify-between"
				>
					<div className="flex items-center gap-3">
						<span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium">
							#{entry.id}
						</span>
						<span className="font-medium">{entry.user.name}</span>
					</div>
					<div className="flex items-center gap-2 text-sm text-muted">
						<Icons.Clock className="h-4 w-4" />{' '}
						{displayWorkSessionDuration(entry)}
					</div>
				</div>
			))}
		</div>
	);
}
