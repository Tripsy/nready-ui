import { formatEnumLabel } from '@/helpers/string.helper';

/**
 * Mirrors `rating` in the backend. The table is append-only - no `updated_at`, no `deleted_at` -
 * so the dashboard only ever reads a row or removes it; there is no create, update or restore.
 */

/** What is being rated. Polymorphic target, paired with `entity_id`. */
export const RatingEntityTypeEnum = {
	ARTICLE: 'article',
	COMMENT: 'comment',
} as const;

export type RatingEntityType =
	(typeof RatingEntityTypeEnum)[keyof typeof RatingEntityTypeEnum];

/**
 * How the target was rated. The three are mutually exclusive per row and decide which of
 * `value` / `reaction` carries the rating - the backend enforces that pairing with check
 * constraints, so a row never holds both.
 */
export const RatingTypeEnum = {
	/** `value` is 1 or -1 */
	LIKE: 'like',
	/** `value` is 1-5 */
	STARS: 'stars',
	/** `reaction` holds the emoji, `value` is null */
	EMOJI: 'emoji',
} as const;

export type RatingType = (typeof RatingTypeEnum)[keyof typeof RatingTypeEnum];

export const RatingEmojiEnum = {
	LIKE: 'like',
	DISLIKE: 'dislike',
	LOVE: 'love',
	INSIGHTFUL: 'insightful',
	FUNNY: 'funny',
} as const;

export type RatingEmoji =
	(typeof RatingEmojiEnum)[keyof typeof RatingEmojiEnum];

/**
 * `user_ip_hash` is a column on the table but is deliberately never selected by the backend's
 * list or read query - it identifies a visitor across every target they rated - so it has no
 * place in this type.
 */
export type RatingModel<D = Date | string> = {
	id: number;

	entity_type: RatingEntityType;
	entity_id: number;
	type: RatingType;

	value: number | null;
	reaction: RatingEmoji | null;

	/** Null for a guest rating, which is cast against the origin address alone. */
	user_id: number | null;
	user?: { id: number; name: string; email?: string } | null;

	/** When the visitor first rated this target. */
	created_at: D;
	/** When they last changed that rating - see `wasRatingChanged` before showing it. */
	updated_at: D | null;
};

/**
 * What `GET /public/ratings/:entity_type/:entity_id` returns for one target: the aggregate
 * over every visitor, and the rows this visitor themselves cast - the two halves a rating
 * widget renders at once, which is why the backend resolves them together.
 *
 * `own` carries at most one row per rating type, by the uniques on the table. It is resolved
 * from the caller's session and origin address, so it is never the same for two readers and
 * a response holding it must not be cached anywhere shared.
 */
export type RatingSummaryType = {
	total: number;
	like: {
		up: number;
		down: number;
		score: number;
	};
	stars: {
		count: number;
		average: number;
		distribution: Record<number, number>;
	};
	emoji: Partial<Record<RatingEmoji, number>>;
};

export type RatingOwnEntryType<D = Date | string> = {
	id: number;
	type: RatingType;
	value: number | null;
	reaction: RatingEmoji | null;
	created_at: D;
	updated_at: D | null;
};

export type RatingPublicReadType = {
	summary: RatingSummaryType;
	own: RatingOwnEntryType[];
};

/**
 * The same two halves for a set of targets, keyed by target id - what a list of rated things
 * reads so its request count does not grow with its length.
 *
 * A target nobody has rated is absent from both maps rather than present and empty, so read them
 * with a fallback: the ids asked about are the caller's own list, not something to rediscover here.
 */
export type RatingSummaryListType = {
	summaries: Record<number, RatingSummaryType>;
	own: Record<number, RatingOwnEntryType[]>;
};

/** How many reactions a target carries, whichever they are. */
export const countRatingReactions = (summary?: RatingSummaryType): number =>
	summary
		? Object.values(summary.emoji).reduce(
				(total, count) => total + count,
				0,
			)
		: 0;

/** The two directions a `like` rating can hold, mirroring `CHK_rating_like_range`. */
export const RATING_LIKE_UP = 1;
export const RATING_LIKE_DOWN = -1;

export const displayRatingLabel = (entry: RatingModel) =>
	`${entry.entity_type}-${entry.entity_id}`;

/**
 * The column defaults to `now()` on insert, so a rating nobody has revisited carries an
 * `updated_at` equal to its `created_at` - displaying it raw reads as an edit that never
 * happened. Rows cast before the column existed carry null.
 */
export const wasRatingChanged = (entry: RatingModel): boolean => {
	if (!entry.updated_at) {
		return false;
	}

	return (
		new Date(entry.updated_at).getTime() >
		new Date(entry.created_at).getTime()
	);
};

const RATING_EMOJI_SYMBOLS: Record<RatingEmoji, string> = {
	like: '👍',
	dislike: '👎',
	love: '❤️',
	insightful: '💡',
	funny: '😄',
};

/**
 * The rating as one readable cell, whichever column holds it. A like reads as a direction
 * rather than as `1` / `-1`, which says nothing on its own next to a stars row.
 */
export const displayRatingValue = (entry: RatingModel): string => {
	switch (entry.type) {
		case RatingTypeEnum.LIKE:
			return entry.value === 1 ? '👍 +1' : '👎 -1';

		case RatingTypeEnum.STARS:
			return entry.value === null
				? ''
				: `${'★'.repeat(entry.value)} (${entry.value})`;

		case RatingTypeEnum.EMOJI:
			return entry.reaction
				? `${RATING_EMOJI_SYMBOLS[entry.reaction]} ${formatEnumLabel(entry.reaction)}`
				: '';
	}
};
