'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { MailQueueModel } from '@/models/mail-queue.model';

const TRANSLATION_KEYS = [
	'mail-queue.field.created_at',
	'mail-queue.field.error',
	'mail-queue.field.content',
	'mail-queue.field.id',
	'mail-queue.field.template',
	'mail-queue.field.language',
	'mail-queue.field.layout',
	'mail-queue.field.email_from',
	'mail-queue.field.email_to',
	'mail-queue.field.sent_at',
	'mail-queue.field.status',
	'mail-queue.field.subject',
	'mail-queue.field.updated_at',
	'mail-queue.field.vars',
	'mail-queue.section.email_data',
	'mail-queue.section.state',
	'mail-queue.section.timestamps',
] as const;

export function ViewMailQueue({ entry }: { entry: MailQueueModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['mail-queue.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['mail-queue.section.state']}>
				<ViewField
					label={translations['mail-queue.field.status']}
					value={
						<div className="max-w-60">
							<DisplayStatus
								status={entry.status}
								dataSource="mail-queue"
							/>
						</div>
					}
				/>
				<ViewField
					label={translations['mail-queue.field.error']}
					value={entry.error}
				/>
				<ViewField
					label={translations['mail-queue.field.sent_at']}
					value={formatDate(entry.sent_at, 'date-time')}
				/>
				<ViewField
					label={translations['mail-queue.field.email_to']}
					value={`${entry.to.name} <${entry.to.address}>`}
				/>
				{entry.from && (
					<ViewField
						label={translations['mail-queue.field.email_from']}
						value={`${entry.from.name} <${entry.from.address}>`}
					/>
				)}
			</ViewSection>

			<ViewSection title={translations['mail-queue.section.email_data']}>
				<ViewField
					label={translations['mail-queue.field.template']}
					value={entry.template?.label}
				/>
				<ViewField
					label={translations['mail-queue.field.language']}
					value={entry.language}
				/>
				<ViewField
					label={translations['mail-queue.field.layout']}
					value={entry.content.layout}
				/>
				<ViewField
					label={translations['mail-queue.field.subject']}
					value={entry.content.subject}
				/>
				<ViewField
					label={translations['mail-queue.field.content']}
					value={entry.content.html}
					full
				/>
				<ViewField
					label={translations['mail-queue.field.vars']}
					value={JSON.stringify(entry.content.vars, null, 2)}
					full
				/>
			</ViewSection>

			<ViewSection title={translations['mail-queue.section.timestamps']}>
				<ViewField
					label={translations['mail-queue.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['mail-queue.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
			</ViewSection>
		</div>
	);
}
