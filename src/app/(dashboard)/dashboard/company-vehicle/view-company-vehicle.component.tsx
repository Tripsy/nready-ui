'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';

export function ViewCompanyVehicle({ entry }: { entry: CompanyVehicleModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="company-vehicle"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField label="License Plate" value={entry.license_plate} />
				<ViewField label="Scope" value={formatEnumLabel(entry.scope)} />
				<ViewField label="Brand" value={entry.vehicle.brand?.name} />
				<ViewField label="Model" value={entry.vehicle.model} />
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
