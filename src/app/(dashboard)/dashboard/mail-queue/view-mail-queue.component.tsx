import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import type { MailQueueModel } from '@/models/mail-queue.model';

export function ViewMailQueue({ entry }: { entry: MailQueueModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="State">
				<ViewField
					label="Status"
					value={
						<div className="max-w-60">
							<DisplayStatus
								status={entry.status}
								dataSource="mail-queue"
							/>
						</div>
					}
				/>
				<ViewField label="Error" value={entry.error} />
				<ViewField
					label="Sent At"
					value={formatDate(entry.sent_at, 'date-time')}
				/>
				<ViewField
					label="Email To"
					value={`${entry.to.name} <${entry.to.address}>`}
				/>
				{entry.from && (
					<ViewField
						label="Email From"
						value={`${entry.from.name} <${entry.from.address}>`}
					/>
				)}
			</ViewSection>

			<ViewSection title="Email Data">
				<ViewField label="Template" value={entry.template?.label} />
				<ViewField label="Language" value={entry.language} />
				<ViewField label="Layout" value={entry.content.layout} />
				<ViewField label="Subject" value={entry.content.subject} />
				<ViewField label="Content" value={entry.content.html} full />
				<ViewField
					label="Vars"
					value={JSON.stringify(entry.content.vars, null, 2)}
					full
				/>
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
