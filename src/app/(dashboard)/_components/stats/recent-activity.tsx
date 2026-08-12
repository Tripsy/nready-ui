'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/helpers/date.helper';
import { toTitleCase } from '@/helpers/string.helper';
import { logHistoryActionMeaning } from '@/models/log-history.model';
import { requestStatsRecentActivity } from '@/services/stats.service';

function RecentActivitySkeleton() {
	const items = Array.from({ length: 4 }, (_, i) => ({
		id: `activity-${i}`,
	}));

	return (
		<div className="space-y-4">
			{items.map((v) => (
				<div
					key={v.id}
					className="flex items-center justify-between py-2 border-b border-border last:border-0"
				>
					<div className="space-y-2">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-24" />
					</div>
					<Skeleton className="h-3 w-16" />
				</div>
			))}
		</div>
	);
}

export function RecentActivity() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'recent-activity'],
		queryFn: () => requestStatsRecentActivity(),
		staleTime: 20 * 60 * 1000,
	});

	if (isLoading) {
		return <RecentActivitySkeleton />;
	}

	if (isError) {
		return (
			<div className="text-danger">Failed to load recent activity</div>
		);
	}

	if (!data || data.length === 0) {
		return <div className="text-muted">No recent activity found</div>;
	}

	return (
		<div className="space-y-4">
			{data.map((entry) => (
				<div
					key={entry.id}
					className="flex items-center justify-between py-2 border-b border-border last:border-0"
				>
					<div>
						<p className="font-medium">
							{toTitleCase(entry.entity)} #{entry.entity_id}{' '}
							{logHistoryActionMeaning(entry.action)}
						</p>
						<p className="text-sm text-muted">
							by {entry.performed_by}
						</p>
					</div>
					<span className="text-sm text-muted">
						{timeAgo(entry.recorded_at)}
					</span>
				</div>
			))}
		</div>
	);
}
