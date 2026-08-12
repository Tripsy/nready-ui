'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type { VehicleModel } from '@/models/vehicle.model';

export function ViewVehicle({ entry }: { entry: VehicleModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="vehicle" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.vehicle_type)}
				/>
				<ViewField label="Brand" value={entry.brand?.name} />
				<ViewField label="Model" value={entry.model} />
				<ViewField label="Length (mm)" value={entry.length} />
				<ViewField label="Width (mm)" value={entry.width} />
				<ViewField label="Height (mm)" value={entry.height} />
				<ViewField label="Weight (kg)" value={entry.weight} />
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
