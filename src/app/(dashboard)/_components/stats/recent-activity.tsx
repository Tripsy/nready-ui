'use client';

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import {
	PanelBody,
	PanelRow,
} from '@/app/(dashboard)/_components/stats/panel.component';
import { timeAgo } from '@/helpers/date.helper';
import { toTitleCase } from '@/helpers/string.helper';
import { logHistoryActionMeaning } from '@/models/log-history.model';
import { requestStatsRecentActivity } from '@/services/stats.service';

export function RecentActivity(): JSX.Element {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'recent-activity'],
		queryFn: () => requestStatsRecentActivity(),
		// Longer than its sibling panels: this is an audit trail, not a health signal, and the
		// backend caches the same 20 minutes.
		staleTime: 20 * 60 * 1000,
	});

	return (
		<PanelBody
			isLoading={isLoading}
			isError={isError}
			// `/stats/recent-activity` returns a bare array, not the `{ entries }` envelope
			// the `find` endpoints behind the other panels use.
			isEmpty={!data || data.length === 0}
			errorText="Failed to load recent activity"
			emptyText="No recent activity found"
		>
			{data?.map((entry) => (
				<PanelRow key={entry.id} aside={timeAgo(entry.recorded_at)}>
					<p className="font-medium truncate">
						{toTitleCase(entry.entity)} #{entry.entity_id}{' '}
						{logHistoryActionMeaning(entry.action)}
					</p>
					<p className="text-sm text-muted truncate">
						by {entry.performed_by}
					</p>
				</PanelRow>
			))}
		</PanelBody>
	);
}
