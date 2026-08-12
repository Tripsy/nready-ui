'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { type UserModel, UserRoleEnum } from '@/models/user.model';

export function ViewUser({ entry }: { entry: UserModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Profile">
				<ViewField label="Name" value={entry.name} />
				<ViewField label="Email" value={entry.email} />
			</ViewSection>

			<ViewSection>
				<ViewField label="Language" value={entry.language} />
			</ViewSection>

			<ViewSection title="Account Info">
				<ViewField
					label="Role"
					value={
						<>
							{formatEnumLabel(entry.role)}
							{entry.role === UserRoleEnum.OPERATOR &&
								entry.operator_type && (
									<span>
										{' '}
										/ {formatEnumLabel(entry.operator_type)}
									</span>
								)}
						</>
					}
				/>
				<ViewField
					label="Status"
					value={
						<div className="max-w-60">
							<DisplayStatus
								status={entry.status}
								dataSource="user"
							/>
						</div>
					}
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
