import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { parseJson } from '@/helpers/string.helper';
import type { LogHistoryModel } from '@/models/log-history.model';

export function ViewLogHistory({ entry }: { entry: LogHistoryModel }) {
	const parsedDetails = parseJson(entry.details);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Info">
				<ViewField label="Request ID" value={entry.request_id} />
				<ViewField label="Entity Type" value={entry.entity} />
				<ViewField label="Entity ID" value={entry.entity_id} />
				<ViewField label="Action" value={entry.action} />
				<ViewField label="Auth ID" value={entry.auth_id} />
				<ViewField label="Performed By" value={entry.performed_by} />
				<ViewField label="Source" value={entry.source} />
				<ViewField
					label="Recorded At"
					value={formatDate(entry.recorded_at, 'date-time')}
				/>
			</ViewSection>

			{parsedDetails?.request && (
				<ViewSection title="Request Details">
					{Object.entries(parsedDetails).map(([key, value]) => (
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
