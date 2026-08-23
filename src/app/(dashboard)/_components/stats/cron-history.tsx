'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FormFiltersSelect } from '@/app/(dashboard)/_components/form-filters.component';
import {
	PanelBody,
	PanelRow,
	type PanelView,
} from '@/app/(dashboard)/_components/stats/panel.component';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { timeAgo } from '@/helpers/date.helper';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type CronHistoryModel,
	type CronHistoryStatus,
	CronHistoryStatusEnum,
} from '@/models/cron-history.model';

const ENTRY_LIMIT = 10;

/** Sentinel for an unset filter — the backend simply receives no `status` filter. */
const FILTER_ALL = 'all';

type StatusFilter = CronHistoryStatus | typeof FILTER_ALL;

const statusOptions = [
	{ label: 'All statuses', value: FILTER_ALL },
	...toOptionsFromEnum(CronHistoryStatusEnum, { formatter: formatEnumLabel }),
];

const STATUS_VARIANT: Record<CronHistoryStatus, BadgeVariant> = {
	[CronHistoryStatusEnum.ERROR]: 'error',
	// `warning` means the job ran but overran its expected time — not a failure, still worth a look.
	[CronHistoryStatusEnum.WARNING]: 'warning',
	[CronHistoryStatusEnum.OK]: 'success',
};

export function useCronHistoryPanel(): PanelView {
	// Opens on failures, for the same reason as the mail queue: successful runs are the norm.
	const [status, setStatus] = useState<StatusFilter>(
		CronHistoryStatusEnum.ERROR,
	);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'cron-history', status],
		queryFn: async () => {
			const response = await requestFind<CronHistoryModel>(
				'cron-history',
				{
					order_by: 'id',
					direction: 'DESC',
					limit: ENTRY_LIMIT,
					page: 1,
					filter: status === FILTER_ALL ? {} : { status },
				},
			);

			if (!response) {
				throw new Error('Could not retrieve cron history');
			}

			return response;
		},
		// Shorter than the provider's 5 min default: a failing job is worth seeing promptly.
		staleTime: 60 * 1000,
	});

	return {
		count: data?.entries.length ?? 0,
		isAlert: status === CronHistoryStatusEnum.ERROR,
		filters: (
			<FormFiltersSelect<{ status: StatusFilter }>
				labelText="Status"
				fieldName="status"
				fieldValue={status}
				options={statusOptions}
				onChange={(value) => setStatus(value as StatusFilter)}
			/>
		),
		body: (
			<PanelBody
				isLoading={isLoading}
				isError={isError}
				isEmpty={!data || data.entries.length === 0}
				errorText="Failed to load cron history"
				emptyText="No cron runs found"
			>
				{data?.entries.map((entry) => (
					<PanelRow key={entry.id} aside={timeAgo(entry.start_at)}>
						<p className="font-medium truncate">{entry.label}</p>
						<div className="flex items-center gap-2 mt-1">
							<Badge
								size="xs"
								variant={STATUS_VARIANT[entry.status]}
							>
								{formatEnumLabel(entry.status)}
							</Badge>
							<span className="text-sm text-muted">
								{entry.run_time}s
							</span>
						</div>
					</PanelRow>
				))}
			</PanelBody>
		),
	};
}
