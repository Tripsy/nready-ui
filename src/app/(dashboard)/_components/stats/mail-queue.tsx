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
	type MailQueueModel,
	type MailQueueStatus,
	MailQueueStatusEnum,
} from '@/models/mail-queue.model';

const ENTRY_LIMIT = 10;

/** Sentinel for an unset filter — the backend simply receives no `status` filter. */
const FILTER_ALL = 'all';

type StatusFilter = MailQueueStatus | typeof FILTER_ALL;

const statusOptions = [
	{ label: 'All statuses', value: FILTER_ALL },
	...toOptionsFromEnum(MailQueueStatusEnum, { formatter: formatEnumLabel }),
];

const STATUS_VARIANT: Record<MailQueueStatus, BadgeVariant> = {
	[MailQueueStatusEnum.ERROR]: 'error',
	[MailQueueStatusEnum.PENDING]: 'warning',
	[MailQueueStatusEnum.SENT]: 'success',
};

export function useMailQueuePanel(): PanelView {
	// Opens on failures: a queue that sent everything needs no attention, a stuck one does.
	const [status, setStatus] = useState<StatusFilter>(
		MailQueueStatusEnum.ERROR,
	);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'mail-queue', status],
		queryFn: async () => {
			const response = await requestFind<MailQueueModel>('mail-queue', {
				order_by: 'id',
				direction: 'DESC',
				limit: ENTRY_LIMIT,
				page: 1,
				filter: status === FILTER_ALL ? {} : { status },
			});

			if (!response) {
				throw new Error('Could not retrieve mail queue');
			}

			return response;
		},
		// Shorter than the provider's 5 min default: a failing queue is worth seeing promptly.
		staleTime: 60 * 1000,
	});

	return {
		count: data?.entries.length ?? 0,
		isAlert: status === MailQueueStatusEnum.ERROR,
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
				errorText="Failed to load mail queue"
				emptyText="No mail queue entries found"
			>
				{data?.entries.map((entry) => (
					<PanelRow key={entry.id} aside={timeAgo(entry.created_at)}>
						<p className="font-medium truncate">
							{entry.to.address}
						</p>
						<div className="flex items-center gap-2 mt-1">
							<Badge
								size="xs"
								variant={STATUS_VARIANT[entry.status]}
							>
								{formatEnumLabel(entry.status)}
							</Badge>
							{entry.template ? (
								<span className="text-sm text-muted truncate">
									{entry.template.label}
								</span>
							) : null}
						</div>
					</PanelRow>
				))}
			</PanelBody>
		),
	};
}
