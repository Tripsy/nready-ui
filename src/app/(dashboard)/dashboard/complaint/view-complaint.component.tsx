'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	ComplaintEntityTypeEnum,
	type ComplaintModel,
	ComplaintReasonEnum,
	displayComplaintReporter,
} from '@/models/complaint.model';

const TRANSLATION_KEYS = [
	'complaint.field.created_at',
	'complaint.field.deleted_at',
	'complaint.field.description',
	'complaint.field.email',
	'complaint.field.entity_id',
	'complaint.field.entity_type',
	'complaint.field.id',
	'complaint.field.reason',
	'complaint.field.user',
	'complaint.field.resolved_at',
	'complaint.field.resolved_by',
	'complaint.field.status',
	'complaint.field.updated_at',
	'complaint.field.user_id',
	'complaint.section.report',
	'complaint.section.reporter',
	'complaint.section.resolution',
	'complaint.section.target',
	'complaint.section.timestamps',
	'complaint.status.open',
	'complaint.status.resolved',
	...enumTranslationKeys('complaint.reason', ComplaintReasonEnum),
	...enumTranslationKeys(
		'complaint.enum.entity_type',
		ComplaintEntityTypeEnum,
	),
] as const;

export function ViewComplaint({ entry }: { entry: ComplaintModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['complaint.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['complaint.section.report']}>
				<ViewField
					label={translations['complaint.field.reason']}
					value={translateEnumLabel(
						translations,
						'complaint.reason',
						entry.reason,
					)}
				/>
				{/* The whole text, unlike the list cell, which trims it to a width. */}
				<ViewField
					label={translations['complaint.field.description']}
					value={entry.description}
				/>
			</ViewSection>

			<ViewSection title={translations['complaint.section.target']}>
				<ViewField
					label={translations['complaint.field.entity_type']}
					value={translateEnumLabel(
						translations,
						'complaint.enum.entity_type',
						entry.entity_type,
					)}
				/>
				{/* There is no foreign key behind this id, and a comment is hard-deleted - a
				    complaint outlives what it reported, so the id may name a row that is gone. */}
				<ViewField
					label={translations['complaint.field.entity_id']}
					value={entry.entity_id}
				/>
			</ViewSection>

			<ViewSection title={translations['complaint.section.reporter']}>
				<ViewField
					label={translations['complaint.field.user']}
					value={displayComplaintReporter(entry)}
				/>
				<ViewField
					label={translations['complaint.field.user_id']}
					value={entry.user_id}
				/>
				<ViewField
					label={translations['complaint.field.email']}
					value={entry.user?.email}
				/>
			</ViewSection>

			<ViewSection title={translations['complaint.section.resolution']}>
				{/* Rendered as a word: `ViewField` prints a `false` as an empty cell, which reads
				    as "unknown" rather than "open". */}
				<ViewField
					label={translations['complaint.field.status']}
					value={
						entry.is_resolved
							? translations['complaint.status.resolved']
							: translations['complaint.status.open']
					}
				/>
				<ViewField
					label={translations['complaint.field.resolved_at']}
					value={
						entry.resolved_at
							? formatDate(entry.resolved_at, 'date-time')
							: undefined
					}
				/>
				{/* Cleared when a complaint is reopened, so an open row never names a moderator. */}
				<ViewField
					label={translations['complaint.field.resolved_by']}
					value={entry.resolved_by}
				/>
			</ViewSection>

			<ViewSection title={translations['complaint.section.timestamps']}>
				<ViewField
					label={translations['complaint.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['complaint.field.updated_at']}
					value={
						entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: undefined
					}
				/>
				<ViewField
					label={translations['complaint.field.deleted_at']}
					value={
						entry.deleted_at
							? formatDate(entry.deleted_at, 'date-time')
							: undefined
					}
				/>
			</ViewSection>
		</div>
	);
}
