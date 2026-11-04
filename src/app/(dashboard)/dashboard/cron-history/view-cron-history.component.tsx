'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { parseJson, replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CronHistoryModel } from '@/models/cron-history.model';

const TRANSLATION_KEYS = [
	'cron-history.field.id',
	'cron-history.field.label',
	'cron-history.field.start_at',
	'cron-history.field.end_at',
	'cron-history.field.run_time',
	'cron-history.section.info',
	'cron-history.section.content',
	'cron-history.text.run_time_seconds',
] as const;

export function ViewCronHistory({ entry }: { entry: CronHistoryModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	// The content's keys and values are whatever the job returned - data, not copy
	const parsedContent = parseJson(entry.content);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['cron-history.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="cron-history"
					/>
				</div>
			</div>

			<ViewSection title={translations['cron-history.section.info']}>
				<ViewField
					label={translations['cron-history.field.label']}
					value={entry.label}
				/>
				<ViewField
					label={translations['cron-history.field.start_at']}
					value={formatDate(entry.start_at, 'date-time')}
				/>
				<ViewField
					label={translations['cron-history.field.end_at']}
					value={formatDate(entry.end_at, 'date-time')}
				/>
				<ViewField
					label={translations['cron-history.field.run_time']}
					value={replaceVars(
						translations['cron-history.text.run_time_seconds'],
						{ seconds: entry.run_time },
					)}
				/>
			</ViewSection>

			{parsedContent && (
				<ViewSection
					title={translations['cron-history.section.content']}
				>
					{Object.entries(parsedContent).map(([key, value]) => (
						<ViewField
							key={key}
							label={key}
							value={
								typeof value === 'object'
									? JSON.stringify(value, null, 2)
									: String(value)
							}
							full
						/>
					))}
				</ViewSection>
			)}
		</div>
	);
}
