'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	type DocumentSeriesModel,
	DocumentTypeLabels,
} from '@/models/document-series.model';

export function ViewDocumentSeries({ entry }: { entry: DocumentSeriesModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<span className="ml-2">
					{DocumentTypeLabels[entry.document_type]}
				</span>
			</div>

			<ViewSection title="Series">
				<ViewField label="Code" value={entry.code} />
				<ViewField
					label="Start number"
					value={String(entry.start_number)}
				/>
				{/* The counter only ever moves through an allocation, so this is the number the
				    next document issued against this series will carry. */}
				<ViewField
					label="Next number"
					value={String(entry.next_number)}
				/>
			</ViewSection>

			<ViewSection title="Other">
				<ViewField label="Notes" value={entry.notes} full />
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
			</ViewSection>
		</div>
	);
}
