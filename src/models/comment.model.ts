import { formatEnumLabel } from '@/helpers/string.helper';
import type { StatusTransitions } from '@/types/common.type';

/**
 * Mirrors `comment` in the backend. The table has no `deleted_at` — a removed comment is gone,
 * and its replies go with it through the `parent_id` cascade — so the dashboard has no restore.
 * There is no create either: a comment is written by a reader through `/public/comments`.
 */

export const CommentEntityTypeEnum = {
	ARTICLE: 'article',
	REVIEW: 'review',
} as const;

export type CommentEntityType =
	(typeof CommentEntityTypeEnum)[keyof typeof CommentEntityTypeEnum];

/**
 * The moderation states. Only `approved` is public; everything else is visible to the dashboard
 * alone. The backend refuses any move the transition map does not allow — notably there is no way
 * back to `pending`, which is what stops an approved comment being rewritten and re-queued.
 */
export const CommentStatusEnum = {
	PENDING: 'pending',
	REJECTED: 'rejected',
	SPAM: 'spam',
	APPROVED: 'approved',
	FLAGGED: 'flagged',
} as const;

export type CommentStatus =
	(typeof CommentStatusEnum)[keyof typeof CommentStatusEnum];

/**
 * Which moves a moderator may make from each state, mirroring `STATUS_TRANSITIONS` on the entity.
 * The action buttons are gated on this, so a button never offers a move the backend answers 409 to.
 */
export const COMMENT_STATUS_TRANSITIONS: StatusTransitions<CommentStatus> = {
	[CommentStatusEnum.PENDING]: [
		CommentStatusEnum.APPROVED,
		CommentStatusEnum.REJECTED,
		CommentStatusEnum.SPAM,
	],
	[CommentStatusEnum.REJECTED]: [CommentStatusEnum.APPROVED],
	[CommentStatusEnum.SPAM]: [
		CommentStatusEnum.APPROVED,
		CommentStatusEnum.REJECTED,
	],
	[CommentStatusEnum.APPROVED]: [
		CommentStatusEnum.FLAGGED,
		CommentStatusEnum.REJECTED,
		CommentStatusEnum.SPAM,
	],
	[CommentStatusEnum.FLAGGED]: [
		CommentStatusEnum.APPROVED,
		CommentStatusEnum.REJECTED,
		CommentStatusEnum.SPAM,
	],
};

/** What kind of contribution the comment is. */
export const CommentTypeEnum = {
	COMMENT: 'comment',
	QUESTION: 'question',
	TIP: 'tip',
} as const;

export type CommentType =
	(typeof CommentTypeEnum)[keyof typeof CommentTypeEnum];

export const COMMENT_DEFAULT_TYPE: CommentType = CommentTypeEnum.COMMENT;

export type CommentLocationModel = {
	id: number;
	entity_type: CommentEntityType;
	entity_id: number;
	parent_id: number | null;
};

/**
 * What a subscriber hears about. `unsubscribed` is one of the three rather than a deleted row:
 * the backend keeps the row so that commenting again does not silently re-subscribe somebody who
 * opted out.
 */
export const CommentSubscriptionTypeEnum = {
	ALL: 'all',
	REPLIES_TO_ME: 'replies_to_me',
	UNSUBSCRIBED: 'unsubscribed',
} as const;

export type CommentSubscriptionType =
	(typeof CommentSubscriptionTypeEnum)[keyof typeof CommentSubscriptionTypeEnum];

/**
 * What `/public/comment-subscriptions/:token` answers with — everything the unsubscribe page has
 * to show, and nothing the token's holder does not already know: the address is the one the email
 * they are holding was sent to.
 */
export type CommentSubscriptionModel = {
	entity_type: CommentEntityType;
	entity_id: number;
	user_email: string;
	/** What the notification was written in — and what the landing page renders in. */
	language: string;
	notification_type: CommentSubscriptionType;
};

/**
 * `user_ip_hash` is a column on the table but is never selected by the backend's list or read
 * query — it identifies a visitor across every comment they ever left — so it has no place here.
 * `guest_email` comes back on the single read only, not in the list.
 */
export type CommentModel<D = Date | string> = {
	id: number;

	entity_type: CommentEntityType;
	entity_id: number;
	type: CommentType;
	content: string;
	status: CommentStatus;

	/** Null for a root comment; otherwise the comment this one replies to. */
	parent_id: number | null;

	/** Null for a guest, who is identified by the origin address alone. */
	user_id: number | null;
	/**
	 * `avatar` is not part of the public read today — the backend selects only the id and the
	 * name, and the `user` table carries no avatar column — so a member's comment renders the
	 * same initial a guest's does. It is typed here because the avatar is what the field is for
	 * the day either of those changes.
	 */
	user?: {
		id: number;
		name: string;
		email?: string;
		avatar?: string | null;
	} | null;
	guest_name: string | null;
	guest_email?: string | null;
	guest_website: string | null;

	/** Direct replies that are approved — the backend moves it as replies become visible. */
	reply_count: number;
	is_pinned: boolean;
	is_staff: boolean;

	moderated_at?: D | null;
	moderated_by?: number | null;
	moderation_reason?: string | null;

	created_at: D;
	updated_at: D | null;
	/**
	 * When the text was last rewritten, and null for a comment nobody has touched since posting —
	 * which is what the thread renders its "edited" marker from.
	 *
	 * Not `updated_at`: that one moves for every save on the row, a moderation decision and a pin
	 * included, so it would mark comments whose text never changed.
	 */
	edited_at?: D | null;
};

/** Who signed the comment: the account behind it, or the name a guest gave. */
export const displayCommentAuthor = (entry: CommentModel): string => {
	if (entry.user) {
		return `${entry.user.name} (#${entry.user_id})`;
	}

	return entry.guest_name ? `${entry.guest_name} (guest)` : 'Guest';
};

/**
 * Enough of the text to recognize the row by, for a window title. The id is left out: the window
 * appends `(#id)` itself, and carrying it here would print it twice.
 */
export const displayCommentLabel = (entry: CommentModel): string => {
	const content = entry.content.trim();
	const excerpt = content.slice(0, 50);

	return excerpt.length < content.length ? `${excerpt}…` : excerpt;
};

/** The thread position as one cell: a root, or the comment it answers. */
export const displayCommentThread = (entry: CommentModel): string =>
	entry.parent_id ? `Reply to #${entry.parent_id}` : 'Root';

export const displayCommentType = (entry: CommentModel): string =>
	formatEnumLabel(entry.type);
