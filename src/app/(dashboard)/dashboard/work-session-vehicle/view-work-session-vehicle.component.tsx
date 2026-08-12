'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { displayCompanyVehicleLabel } from '@/models/company-vehicle.model';
import type { WorkSessionVehicleModel } from '@/models/work-session-vehicle.model';

export function ViewWorkSessionVehicle({
	entry,
}: {
	entry: WorkSessionVehicleModel;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="work-session-vehicle"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Vehicle"
					value={displayCompanyVehicleLabel(entry.company_vehicle)}
				/>
				<ViewField label="Start (km)" value={entry.vehicle_km_start} />
				<ViewField label="End (km)" value={entry.vehicle_km_end} />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Assigned At"
					value={formatDate(entry.assigned_at, 'date-time')}
				/>
				<ViewField
					label="Returned At"
					value={formatDate(entry.returned_at, 'date-time')}
				/>
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
