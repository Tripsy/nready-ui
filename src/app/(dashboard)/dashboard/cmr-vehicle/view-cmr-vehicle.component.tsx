'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import type { CmrVehicleModel } from '@/models/cmr-vehicle.model';
import { displayVehicleLabel } from '@/models/vehicle.model';

export function ViewCmrVehicle({ entry }: { entry: CmrVehicleModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Vehicle"
					value={displayVehicleLabel(entry.vehicle)}
				/>
				<ViewField label="License Plate" value={entry.license_plate} />
				<ViewField label="VIN" value={entry.vin} />
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
