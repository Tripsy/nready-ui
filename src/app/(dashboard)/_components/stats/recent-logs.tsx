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
	type LogCategory,
	LogCategoryEnum,
	type LogDataModel,
	type LogLevel,
	LogLevelEnum,
} from '@/models/log-data.model';

const ENTRY_LIMIT = 10;

/** Sentinel for an unset filter — the backend simply receives no filter for that field. */
const FILTER_ALL = 'all';

type CategoryFilter = LogCategory | typeof FILTER_ALL;
type LevelFilter = LogLevel | typeof FILTER_ALL;

const categoryOptions = [
	{ label: 'All categories', value: FILTER_ALL },
	...toOptionsFromEnum(LogCategoryEnum, { formatter: formatEnumLabel }),
];

const levelOptions = [
	{ label: 'All levels', value: FILTER_ALL },
	...toOptionsFromEnum(LogLevelEnum, { formatter: formatEnumLabel }),
];

/** Severity coloring for the level badge. Anything below `warn` stays neutral. */
const LEVEL_VARIANT: Partial<Record<LogLevel, BadgeVariant>> = {
	[LogLevelEnum.WARN]: 'warning',
	[LogLevelEnum.ERROR]: 'error',
	[LogLevelEnum.FATAL]: 'error',
};

export function useLogDataPanel(): PanelView {
	// Severity is `level`, not `category`: the logger only ever writes the `system`, `history`
	// and `cron` categories (see the API's `logger.provider.ts`). Opening on `level = error` is
	// what makes this panel answer "is anything broken" at a glance.
	const [level, setLevel] = useState<LevelFilter>(LogLevelEnum.ERROR);
	const [category, setCategory] = useState<CategoryFilter>(FILTER_ALL);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'recent-logs', category, level],
		queryFn: async () => {
			const response = await requestFind<LogDataModel>('log-data', {
				order_by: 'id',
				direction: 'DESC',
				limit: ENTRY_LIMIT,
				page: 1,
				filter: {
					...(category === FILTER_ALL ? {} : { category }),
					...(level === FILTER_ALL ? {} : { level }),
				},
			});

			if (!response) {
				throw new Error('Could not retrieve log data');
			}

			return response;
		},
		// Shorter than the provider's 5 min default: this panel answers "is anything failing
		// right now", and a stale empty list reads as an all-clear it has not earned.
		staleTime: 60 * 1000,
	});

	return {
		count: data?.entries.length ?? 0,
		// `warn` is not a failure and `all` is a mixed bag, so neither earns the alert color.
		isAlert: level === LogLevelEnum.ERROR || level === LogLevelEnum.FATAL,
		filters: (
			<>
				<FormFiltersSelect<{ level: LevelFilter }>
					labelText="Level"
					fieldName="level"
					fieldValue={level}
					options={levelOptions}
					onChange={(value) => setLevel(value as LevelFilter)}
				/>

				<FormFiltersSelect<{ category: CategoryFilter }>
					labelText="Category"
					fieldName="category"
					fieldValue={category}
					options={categoryOptions}
					onChange={(value) => setCategory(value as CategoryFilter)}
				/>
			</>
		),
		body: (
			<PanelBody
				isLoading={isLoading}
				isError={isError}
				isEmpty={!data || data.entries.length === 0}
				errorText="Failed to load log data"
				emptyText="No log entries found"
			>
				{data?.entries.map((entry) => (
					<PanelRow key={entry.id} aside={timeAgo(entry.created_at)}>
						{/* Messages are free-form and can be long — clamp rather than let
							    one entry stretch the panel past its neighbor. */}
						<p className="font-medium truncate">{entry.message}</p>
						<div className="flex items-center gap-2 mt-1">
							<Badge
								size="xs"
								variant={LEVEL_VARIANT[entry.level]}
							>
								{formatEnumLabel(entry.level)}
							</Badge>
							<span className="text-sm text-muted">
								{formatEnumLabel(entry.category)}
							</span>
						</div>
					</PanelRow>
				))}
			</PanelBody>
		),
	};
}
