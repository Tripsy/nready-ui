'use client';

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import {
	PanelBody,
	PanelRow,
} from '@/app/(dashboard)/_components/stats/panel.component';
import { getLanguageClient } from '@/config/translate.setup';
import { timeAgo } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	LogHistoryActions,
	LogHistoryEntities,
} from '@/models/log-history.model';
import { requestStatsRecentActivity } from '@/services/stats.service';

const TRANSLATION_KEYS = [
	'dashboard.text.failed_to_load_recent_activity',
	'dashboard.text.no_recent_activity_found',
	'log-history.text.activity_summary',
	'log-history.text.performed_by',
	...enumTranslationKeys('log-history.enum.entity', LogHistoryEntities),
	...enumTranslationKeys('log-history.activity', LogHistoryActions),
] as const;

export function RecentActivity(): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);

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
			errorText={
				translations['dashboard.text.failed_to_load_recent_activity']
			}
			emptyText={translations['dashboard.text.no_recent_activity_found']}
		>
			{data?.map((entry) => (
				<PanelRow
					key={entry.id}
					aside={timeAgo(entry.recorded_at, getLanguageClient())}
				>
					<p className="font-medium truncate">
						{replaceVars(
							translations['log-history.text.activity_summary'],
							{
								entity: translateEnumLabel(
									translations,
									'log-history.enum.entity',
									entry.entity,
								),
								id: entry.entity_id,
								action: translateEnumLabel(
									translations,
									'log-history.activity',
									entry.action,
								),
							},
						)}
					</p>
					<p className="text-sm text-muted truncate">
						{replaceVars(
							translations['log-history.text.performed_by'],
							{
								name: entry.performed_by,
							},
						)}
					</p>
				</PanelRow>
			))}
		</PanelBody>
	);
}
