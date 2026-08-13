'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import type { CarrierModel } from '@/models/carrier.model';

export function ViewCarrier({ entry }: { entry: CarrierModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<span className="ml-2">{entry.name}</span>
			</div>

			<ViewSection title="Contact">
				<ViewField label="Website" value={entry.website} />
				<ViewField label="Phone" value={entry.phone} />
				<ViewField label="Email" value={entry.email} />
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
