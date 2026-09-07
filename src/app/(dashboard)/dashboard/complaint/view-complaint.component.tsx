'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type ComplaintModel,
	displayComplaintReporter,
	displayComplaintResolution,
} from '@/models/complaint.model';

export function ViewComplaint({ entry }: { entry: ComplaintModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Report">
				<ViewField
					label="Reason"
					value={formatEnumLabel(entry.reason)}
				/>
				{/* The whole text, unlike the list cell, which trims it to a width. */}
				<ViewField label="Description" value={entry.description} />
			</ViewSection>

			<ViewSection title="Target">
				<ViewField
					label="Entity Type"
					value={formatEnumLabel(entry.entity_type)}
				/>
				{/* There is no foreign key behind this id, and a comment is hard-deleted - a
				    complaint outlives what it reported, so the id may name a row that is gone. */}
				<ViewField label="Entity ID" value={entry.entity_id} />
			</ViewSection>

			<ViewSection title="Reporter">
				<ViewField
					label="Reporter"
					value={displayComplaintReporter(entry)}
				/>
				<ViewField label="User ID" value={entry.user_id} />
				<ViewField label="Email" value={entry.user?.email} />
			</ViewSection>

			<ViewSection title="Resolution">
				{/* Rendered as a word: `ViewField` prints a `false` as an empty cell, which reads
				    as "unknown" rather than "open". */}
				<ViewField
					label="Status"
					value={displayComplaintResolution(entry)}
				/>
				<ViewField
					label="Resolved At"
					value={
						entry.resolved_at
							? formatDate(entry.resolved_at, 'date-time')
							: undefined
					}
				/>
				{/* Cleared when a complaint is reopened, so an open row never names a moderator. */}
				<ViewField label="Resolved By" value={entry.resolved_by} />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={
						entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: undefined
					}
				/>
				<ViewField
					label="Deleted At"
					value={
						entry.deleted_at
							? formatDate(entry.deleted_at, 'date-time')
							: undefined
					}
				/>
			</ViewSection>
		</div>
	);
}
