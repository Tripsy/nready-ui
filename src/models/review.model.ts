import type { Language, StatusTransitions } from '@/types/common.type';

/**
 * Mirrors `review` in the backend. A review is written by a buyer through `/public/reviews`, so
 * the dashboard has no create - it moderates what arrives. The table is soft-deletable, so delete
 * and restore are both here, and a withdrawn review frees the slot: the unique that allows one
 * live review per buyer per product is partial on `deleted_at IS NULL`.
 */

/**
 * The moderation states. Only `approved` is public, and only an approved review accepts comments,
 * ratings or complaints of its own. Nothing returns a review to `pending` - the backend refuses
 * the move, which is what stops an approved review being re-queued.
 */
export const ReviewStatusEnum = {
	PENDING: 'pending',
	REJECTED: 'rejected',
	SPAM: 'spam',
	APPROVED: 'approved',
} as const;

export type ReviewStatus =
	(typeof ReviewStatusEnum)[keyof typeof ReviewStatusEnum];

/**
 * Which moves a moderator may make from each state, mirroring `STATUS_TRANSITIONS` on the entity.
 * The action buttons are gated on this, so a button never offers a move the backend answers 409 to.
 */
export const REVIEW_STATUS_TRANSITIONS: StatusTransitions<ReviewStatus> = {
	[ReviewStatusEnum.PENDING]: [
		ReviewStatusEnum.REJECTED,
		ReviewStatusEnum.SPAM,
		ReviewStatusEnum.APPROVED,
	],
	[ReviewStatusEnum.REJECTED]: [ReviewStatusEnum.APPROVED],
	[ReviewStatusEnum.SPAM]: [
		ReviewStatusEnum.REJECTED,
		ReviewStatusEnum.APPROVED,
	],
	[ReviewStatusEnum.APPROVED]: [
		ReviewStatusEnum.REJECTED,
		ReviewStatusEnum.SPAM,
	],
};

/**
 * The dimensions a reviewer may score, each out of 5. A review carries at least one of them and
 * nothing else - the backend holds both halves of that rule as a check constraint.
 *
 * Read every dimension as optional whatever this list says: dropping one leaves the older rows
 * carrying it, and a partly-scored review is the ordinary case rather than the exception.
 */
export const REVIEW_RATING_DIMENSIONS = [
	'quality',
	'price',
	'service',
	'delivery',
] as const;

export type ReviewRatingDimension = (typeof REVIEW_RATING_DIMENSIONS)[number];

export type ReviewRating = Partial<Record<ReviewRatingDimension, number>>;

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/**
 * `rating` is selected by the single read only, not by the list - which is why the view window
 * re-fetches the row rather than rendering the one the table already holds. The moderation trail
 * is the same.
 */
export type ReviewModel<D = Date | string> = {
	id: number;

	product_id: number;
	/** The variant the review is about; null when it was written from the product page. */
	variant_id: number | null;
	variant?: {
		id: number;
		sku: string;
	} | null;

	/**
	 * The reviewed product, joined by the dashboard listing so the target can be named rather
	 * than numbered. `contents` holds a single translation - the request's language - so a
	 * product with none in it arrives with an empty array and the target falls back to the id.
	 */
	product?: {
		id: number;
		contents?: { language: Language; label: string; slug: string }[];
		/**
		 * The default variant alone, joined for its code. The backend aliases the join, so this
		 * is never the product's full variant set - only the one row that stands for it.
		 */
		variants?: { id: number; sku: string }[];
	} | null;

	/**
	 * The order the reviewed purchase was made on. Null on every review today - nothing on the
	 * backend writes it yet, because a review names a user while an order names a client and no
	 * column joins the two. It stays nullable afterwards: a review written from a product page or
	 * imported from elsewhere names no order.
	 *
	 * Returned by the dashboard read and list only; the storefront never sees it.
	 */
	order_id?: number | null;

	rating?: ReviewRating;
	/**
	 * The scores given, averaged over the ones given - never over the four that exist, which
	 * would score a partly-filled review as though the blanks were zeros. This is what the
	 * listings sort by and the star filter compares against.
	 */
	rating_avg: number;
	content: string;
	status: ReviewStatus;

	/** Always an account: `user_id` is not nullable, so a review has no guest path. */
	user_id: number;
	user?: {
		id: number;
		name: string;
		email?: string;
	} | null;

	is_pinned: boolean;
	/** Set by a moderator; the backend derives it from nothing on its own. */
	is_verified: boolean;

	moderated_at?: D | null;
	moderated_by?: number | null;
	/**
	 * The moderator's account, joined by the dashboard read. Absent when nobody decided (a
	 * background sweep) - and also when the account has been deleted, since the id is kept
	 * without a foreign key so the trail outlives the user.
	 */
	moderator?: {
		id: number;
		name: string;
	} | null;
	moderation_reason?: string | null;

	created_at: D;
	updated_at: D | null;
	deleted_at?: D | null;
};

/**
 * What the storefront receives. Narrower than the dashboard read: no status, no moderation trail,
 * no order and no joined product - a visitor is shown the review and who wrote it.
 */
export type ReviewPublicModel<D = Date | string> = Omit<
	ReviewModel<D>,
	| 'status'
	| 'moderated_at'
	| 'moderated_by'
	| 'moderation_reason'
	| 'moderator'
	| 'deleted_at'
	| 'order_id'
	| 'product'
>;

/**
 * The reader's own review, which carries its `status` - the one row somebody may see before a
 * moderator has, and what tells them it is still awaiting moderation.
 */
export type ReviewOwnModel<D = Date | string> = ReviewPublicModel<D> & {
	status: ReviewStatus;
};

/** What `GET /public/reviews/:product_id` answers with. */
export type ReviewPublicListType = {
	entries: ReviewPublicModel[];
	own: ReviewOwnModel | null;
	pagination: { page: number; limit: number; total: number };
};

/**
 * The aggregate over a product's approved reviews.
 *
 * `distribution` is keyed by whole stars (the review average, rounded), and `dimensions` averages
 * each score over the reviews that gave it - so a dimension nobody scored is an absent key rather
 * than a zero.
 */
export type ReviewSummaryType = {
	total: number;
	average: number;
	distribution: Record<number, number>;
	dimensions: Partial<Record<ReviewRatingDimension, number>>;
};

/** What was reviewed, as one cell: the product, and the variant when the buyer named one. */
export const displayReviewTarget = (entry: ReviewModel): string =>
	entry.variant_id
		? `Product #${entry.product_id} / variant #${entry.variant_id}`
		: `Product #${entry.product_id}`;

/**
 * How the listing names the reviewed product: its label in the joined translation, the code of
 * the variant the review is about - or the product's default variant, since a product carries no
 * code of its own - and the slug the public page is addressed by.
 *
 * Each part is independently absent. A product with no translation in the request's language has
 * no label and no slug, and one whose default variant was withdrawn has no code, so the caller
 * renders what it got rather than assuming a full triple.
 */
export const resolveReviewProduct = (
	entry: ReviewModel,
): { label: string; slug: string | null; sku: string | null } => {
	const content = entry.product?.contents?.[0];

	return {
		label: content?.label || `Product #${entry.product_id}`,
		slug: content?.slug || null,
		sku: entry.variant?.sku || entry.product?.variants?.[0]?.sku || null,
	};
};

/** Who wrote it. The account is always there; its name is only joined by the list and read. */
export const displayReviewAuthor = (entry: ReviewModel): string =>
	entry.user ? `${entry.user.name} (#${entry.user_id})` : `#${entry.user_id}`;

/**
 * Enough of the text to recognize the row by, for a window title. The id is left out: the window
 * appends `(#id)` itself, and carrying it here would print it twice.
 */
export const displayReviewLabel = (entry: ReviewModel): string => {
	const content = entry.content.trim();
	const excerpt = content.slice(0, 50);

	return excerpt.length < content.length ? `${excerpt}…` : excerpt;
};
