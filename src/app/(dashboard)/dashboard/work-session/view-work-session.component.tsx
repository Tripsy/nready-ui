'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	displayWorkSessionDuration,
	type WorkSessionModel,
} from '@/models/work-session.model';

export function ViewWorkSession({ entry }: { entry: WorkSessionModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="work-session"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField label="User" value={entry.user.name} />
				<ViewField
					label="Start At"
					value={formatDate(entry.start_at, 'date-time')}
				/>
				<ViewField
					label="End At"
					value={formatDate(entry.end_at, 'date-time')}
				/>
				<ViewField
					label="Duration"
					value={displayWorkSessionDuration(entry)}
				/>
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label="Deleted At"
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
