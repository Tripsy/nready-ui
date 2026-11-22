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
	CommentEntityTypeEnum,
	type CommentModel,
	CommentStatusEnum,
	CommentTypeEnum,
	displayCommentAuthor,
	displayCommentThread,
} from '@/models/comment.model';

const TRANSLATION_KEYS = [
	'comment.field.user',
	'comment.field.content',
	'comment.field.created_at',
	'comment.field.email',
	'comment.field.entity_id',
	'comment.field.entity_type',
	'comment.field.guest_website',
	'comment.field.id',
	'comment.field.is_pinned',
	'comment.field.is_staff',
	'comment.field.moderated_at',
	'comment.field.moderated_by',
	'comment.field.moderation_reason',
	'comment.field.reply_count',
	'comment.field.status',
	'comment.field.thread',
	'comment.field.type',
	'comment.field.updated_at',
	'comment.field.user_id',
	'comment.section.author',
	'comment.section.comment',
	'comment.section.moderation',
	'comment.section.target',
	'comment.section.timestamps',
	'dashboard.text.yes',
	'dashboard.text.no',
	'comment.text.thread_root',
	'comment.text.thread_reply',
	'dashboard.text.guest',
	'comment.text.guest_named',
	...enumTranslationKeys('comment.enum.type', CommentTypeEnum),
	...enumTranslationKeys('comment.status', CommentStatusEnum),
	...enumTranslationKeys('comment.enum.entity_type', CommentEntityTypeEnum),
] as const;

export function ViewComment({ entry }: { entry: CommentModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['comment.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['comment.section.comment']}>
				{/* The whole text, unlike the list cell, which trims it to a width. */}
				<ViewField
					label={translations['comment.field.content']}
					value={entry.content}
				/>
				<ViewField
					label={translations['comment.field.type']}
					value={translateEnumLabel(
						translations,
						'comment.enum.type',
						entry.type,
					)}
				/>
				<ViewField
					label={translations['comment.field.status']}
					value={translateEnumLabel(
						translations,
						'comment.status',
						entry.status,
					)}
				/>
				{/* Rendered as words: `ViewField` prints a `false` as an empty cell, which reads
				    as "unknown" rather than "no". */}
				<ViewField
					label={translations['comment.field.is_pinned']}
					value={
						entry.is_pinned
							? translations['dashboard.text.yes']
							: translations['dashboard.text.no']
					}
				/>
				<ViewField
					label={translations['comment.field.is_staff']}
					value={
						entry.is_staff
							? translations['dashboard.text.yes']
							: translations['dashboard.text.no']
					}
				/>
			</ViewSection>

			<ViewSection title={translations['comment.section.target']}>
				<ViewField
					label={translations['comment.field.entity_type']}
					value={translateEnumLabel(
						translations,
						'comment.enum.entity_type',
						entry.entity_type,
					)}
				/>
				<ViewField
					label={translations['comment.field.entity_id']}
					value={entry.entity_id}
				/>
				<ViewField
					label={translations['comment.field.thread']}
					value={displayCommentThread(entry, {
						root: translations['comment.text.thread_root'],
						reply: translations['comment.text.thread_reply'],
					})}
				/>
				{/* Approved replies only - the count follows what a reader can open. */}
				<ViewField
					label={translations['comment.field.reply_count']}
					value={entry.reply_count}
				/>
			</ViewSection>

			<ViewSection title={translations['comment.section.author']}>
				{/* A guest is anchored to the origin address, which the backend never returns,
				    so the name and email they gave are all there is to show. */}
				<ViewField
					label={translations['comment.field.user']}
					value={displayCommentAuthor(entry, {
						guest: translations['dashboard.text.guest'],
						guestNamed: translations['comment.text.guest_named'],
					})}
				/>
				<ViewField
					label={translations['comment.field.user_id']}
					value={entry.user_id}
				/>
				<ViewField
					label={translations['comment.field.email']}
					value={entry.user?.email ?? entry.guest_email}
				/>
				<ViewField
					label={translations['comment.field.guest_website']}
					value={entry.guest_website}
				/>
			</ViewSection>

			<ViewSection title={translations['comment.section.moderation']}>
				<ViewField
					label={translations['comment.field.moderated_at']}
					value={
						entry.moderated_at
							? formatDate(entry.moderated_at, 'date-time')
							: undefined
					}
				/>
				<ViewField
					label={translations['comment.field.moderated_by']}
					value={entry.moderated_by}
				/>
				{/* Overwritten by each decision: it describes the state the comment is in now,
				    not how it got here. */}
				<ViewField
					label={translations['comment.field.moderation_reason']}
					value={entry.moderation_reason}
				/>
			</ViewSection>

			<ViewSection title={translations['comment.section.timestamps']}>
				<ViewField
					label={translations['comment.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['comment.field.updated_at']}
					value={
						entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: undefined
					}
				/>
			</ViewSection>
		</div>
	);
}
