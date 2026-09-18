'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type CommentModel,
	displayCommentAuthor,
	displayCommentThread,
} from '@/models/comment.model';

export function ViewComment({ entry }: { entry: CommentModel }) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Comment">
				{/* The whole text, unlike the list cell, which trims it to a width. */}
				<ViewField label="Content" value={entry.content} />
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField
					label="Status"
					value={formatEnumLabel(entry.status)}
				/>
				{/* Rendered as words: `ViewField` prints a `false` as an empty cell, which reads
				    as "unknown" rather than "no". */}
				<ViewField
					label="Pinned"
					value={entry.is_pinned ? 'Yes' : 'No'}
				/>
				<ViewField
					label="Staff"
					value={entry.is_staff ? 'Yes' : 'No'}
				/>
			</ViewSection>

			<ViewSection title="Target">
				<ViewField
					label="Entity Type"
					value={formatEnumLabel(entry.entity_type)}
				/>
				<ViewField label="Entity ID" value={entry.entity_id} />
				<ViewField label="Thread" value={displayCommentThread(entry)} />
				{/* Approved replies only - the count follows what a reader can open. */}
				<ViewField label="Replies" value={entry.reply_count} />
			</ViewSection>

			<ViewSection title="Author">
				{/* A guest is anchored to the origin address, which the backend never returns,
				    so the name and email they gave are all there is to show. */}
				<ViewField label="Author" value={displayCommentAuthor(entry)} />
				<ViewField label="User ID" value={entry.user_id} />
				<ViewField
					label="Email"
					value={entry.user?.email ?? entry.guest_email}
				/>
				<ViewField label="Website" value={entry.guest_website} />
			</ViewSection>

			<ViewSection title="Moderation">
				<ViewField
					label="Moderated At"
					value={
						entry.moderated_at
							? formatDate(entry.moderated_at, 'date-time')
							: undefined
					}
				/>
				<ViewField label="Moderated By" value={entry.moderated_by} />
				{/* Overwritten by each decision: it describes the state the comment is in now,
				    not how it got here. */}
				<ViewField label="Reason" value={entry.moderation_reason} />
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
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
