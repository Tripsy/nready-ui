'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { getLanguageClient } from '@/config/translate.setup';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { displayAddressLabel } from '@/models/address.model';
import { displayClientLabel } from '@/models/client.model';
import { type CmrModel, displayCmrReference } from '@/models/cmr.model';

export function ViewCmr({ entry }: { entry: CmrModel }) {
	const language = getLanguageClient();

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="cmr" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Reference"
					value={displayCmrReference(
						entry.ref_code,
						entry.ref_number,
					)}
				/>
				<ViewField label="Series Code" value={entry.ref_code} />
				<ViewField
					label="Series Number"
					value={String(entry.ref_number)}
				/>
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.transport_type)}
				/>
				<ViewField
					label="Tracking Number"
					value={entry.tracking_number}
				/>
				<ViewField
					label="Pickup Address"
					value={displayAddressLabel(entry.pickup_address, language)}
				/>
				<ViewField
					label="Delivery Address"
					value={displayAddressLabel(
						entry.delivery_address,
						language,
					)}
				/>
			</ViewSection>

			<ViewSection title="Contact">
				<ViewField
					label="Client"
					value={displayClientLabel(entry.client)}
				/>
				<ViewField label="Contact - Name" value={entry.contact_name} />
				<ViewField
					label="Contact - Email"
					value={entry.contact_email}
				/>
				<ViewField
					label="Contact - Phone"
					value={entry.contact_phone}
				/>
			</ViewSection>

			<ViewSection title="Sign Details">
				<ViewField
					label="Signed At"
					value={formatDate(entry.signed_at, 'date-time')}
				/>
				<ViewField label="Signed By" value={entry.signed_by} />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Ordered At"
					value={formatDate(entry.ordered_at, 'date-time')}
				/>
				<ViewField
					label="Pick Scheduled At"
					value={formatDate(entry.pick_scheduled_at, 'date-time')}
				/>
				<ViewField
					label="Estimated Delivery At"
					value={formatDate(entry.estimated_delivery_at, 'date-time')}
				/>
				<ViewField
					label="Delivered At"
					value={formatDate(entry.delivered_at, 'date-time')}
				/>
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
