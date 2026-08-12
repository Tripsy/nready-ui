'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { type ClientModel, ClientTypeEnum } from '@/models/client.model';

export function ViewClient({ entry }: { entry: ClientModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="user" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.client_type)}
				/>
				{entry.client_type === ClientTypeEnum.COMPANY && (
					<>
						<ViewField label="Name" value={entry.company_name} />
						<ViewField label="CUI" value={entry.company_cui} />
						<ViewField
							label="Reg. Com"
							value={entry.company_reg_com}
						/>
					</>
				)}
				{entry.client_type === ClientTypeEnum.PERSON && (
					<>
						<ViewField label="Name" value={entry.person_name} />
						{entry.person_identification_number && (
							<ViewField
								label="Personal ID"
								value={entry.person_identification_number}
							/>
						)}
					</>
				)}
			</ViewSection>

			<ViewSection title="Contact Details">
				<ViewField label="Name" value={entry.contact_name} />
				<ViewField label="Email" value={entry.contact_email} />
				<ViewField label="Phone" value={entry.contact_phone} />
			</ViewSection>

			<ViewSection title="Financial Details">
				<ViewField label="IBAN" value={entry.iban} />
				<ViewField label="Bank Name" value={entry.bank_name} />
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
