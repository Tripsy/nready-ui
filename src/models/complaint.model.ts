import type { EntityId } from '@/types/entity-id.type';

/**
 * Mirrors `complaint` in the backend. There is no create and no update here: a complaint is filed
 * by a reader through `/public/complaints`, and the text is their accusation - a moderator decides
 * on it (`resolve` / `reopen`) rather than rewriting it.
 *
 * Soft-deleted, so a dismissed complaint is still on record and can be restored.
 */

/** What a complaint can be filed against. A review is not among them: it is flagged through moderation. */
export const ComplaintEntityTypeEnum = {
	ARTICLE: 'article',
	COMMENT: 'comment',
} as const;

export type ComplaintEntityType =
	(typeof ComplaintEntityTypeEnum)[keyof typeof ComplaintEntityTypeEnum];

export const ComplaintReasonEnum = {
	SPAM: 'spam',
	OFFENSIVE: 'offensive',
	HARASSMENT: 'harassment',
	HATE_SPEECH: 'hate_speech',
	MISINFORMATION: 'misinformation',
	AI_SLOP: 'ai_slop',
	COPYRIGHT: 'copyright',
} as const;

export type ComplaintReason =
	(typeof ComplaintReasonEnum)[keyof typeof ComplaintReasonEnum];

/**
 * `is_resolved` and `resolved_at` move together - the backend holds a check constraint tying them,
 * so a resolved complaint always carries the timestamp and an open one never does.
 *
 * `user_id` is never null: a complaint accuses somebody, so it is always attached to an account.
 */
export type ComplaintModel<D = Date | string> = {
	id: EntityId;

	entity_type: ComplaintEntityType;
	entity_id: EntityId;
	reason: ComplaintReason;
	description: string | null;

	/** The reporter. `user` is joined by the list and the single read alike. */
	user_id?: EntityId;
	user?: {
		id: EntityId;
		name: string;
		email?: string;
	} | null;

	is_resolved: boolean;
	resolved_at?: D | null;
	/** The moderator who decided; cleared when a complaint is reopened. */
	resolved_by?: number | null;

	created_at: D;
	updated_at: D | null;
	deleted_at?: D | null;
};

/**
 * What the reporter themselves filed against one target, as `/public/complaints/:type/:id` answers
 * it. A narrower row than the dashboard's: the moderation trail (`resolved_at`, `resolved_by`,
 * `deleted_at`) is not the reporter's to read, and `user_id` is their own by construction.
 *
 * `own` is null when they have filed nothing - a withdrawn complaint frees the slot, so it reads
 * as nothing too.
 */
export type ComplaintOwnEntryType<D = Date | string> = Pick<
	ComplaintModel<D>,
	| 'id'
	| 'entity_type'
	| 'entity_id'
	| 'reason'
	| 'description'
	| 'is_resolved'
	| 'created_at'
	| 'updated_at'
>;

export type ComplaintPublicReadType = {
	own: ComplaintOwnEntryType | null;
};

/**
 * What was reported, as one cell. There is no foreign key behind these two columns - `entity_type`
 * picks the table at read time - and a comment is hard-deleted, so the id may name a row that is
 * no longer there. The complaint outlives it on purpose.
 */
/** `entityTypeLabel` is the caller's (translated) name for `entry.entity_type`. */
export const displayComplaintTarget = (
	entry: ComplaintModel,
	entityTypeLabel: string,
): string => `${entityTypeLabel} #${entry.entity_id}`;

/** The reporter's name, or a dash when the account joins as null (soft-deleted since). */
export const displayComplaintReporter = (entry: ComplaintModel): string =>
	entry.user?.name ?? '-';

/**
 * Enough to recognize the row by, for a window title. The id is left out: the window appends
 * `(#id)` itself, and carrying it here would print it twice.
 */
export const displayComplaintLabel = (
	entry: ComplaintModel,
	wording: { reason: string; entityType: string },
): string =>
	`${wording.reason} - ${displayComplaintTarget(entry, wording.entityType)}`;
