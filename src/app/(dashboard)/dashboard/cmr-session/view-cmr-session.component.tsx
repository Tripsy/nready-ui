'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { displayCmrLabel } from '@/models/cmr.model';
import type { CmrSessionModel } from '@/models/cmr-session.model';

export function ViewCmrSession({ entry }: { entry: CmrSessionModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Info">
				<ViewField label="CMR" value={displayCmrLabel(entry.cmr)} />
				<ViewField label="User" value={entry.work_session.user.name} />
				<ViewField
					label="Work Session Status"
					value={
						<div className="max-w-60">
							<DisplayStatus
								status={entry.work_session.status}
								dataSource="work-session"
							/>
						</div>
					}
				/>
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
