import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { parseJson } from '@/helpers/string.helper';
import type { CronHistoryModel } from '@/models/cron-history.model';

export function ViewCronHistory({ entry }: { entry: CronHistoryModel }) {
	const parsedContent = parseJson(entry.content);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="cron-history"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField label="Label" value={entry.label} />
				<ViewField
					label="Start At"
					value={formatDate(entry.start_at, 'date-time')}
				/>
				<ViewField
					label="End At"
					value={formatDate(entry.end_at, 'date-time')}
				/>
				<ViewField
					label="Run Time"
					value={`${entry.run_time} second(s)`}
				/>
			</ViewSection>

			{parsedContent && (
				<ViewSection title="Content">
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
