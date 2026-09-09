import { ApiRequest } from '@/helpers/api.helper';
import type {
	ReviewOwnModel,
	ReviewPublicListType,
	ReviewRating,
	ReviewSummaryType,
} from '@/models/review.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The reader-facing review endpoints (`/public/reviews`). There is no guest path - `user_id` is
 * `NOT NULL` on the table, so every write answers 401 without a session and the widget asks for a
 * sign-in rather than sending the request. The two reads are open to anyone.
 *
 * All of them go through `/api/proxy` (the default request mode): the backend reads *whose* review
 * a write speaks for from the session the proxy attaches, and the list carries this reader's own
 * row alongside the public ones - so none of it is cacheable anywhere shared.
 */

/**
 * The approved reviews of one product, plus the caller's own when they hold one.
 *
 * `own` arrives whatever its status: it is the one row a reader may see before a moderator has,
 * and it is what decides between offering the form and offering the edit.
 */
export async function requestProductReviews(
	productId: number,
	params?: { page?: number; limit?: number; variant_id?: number },
): Promise<ApiResponseFetch<ReviewPublicListType>> {
	const query = new URLSearchParams();

	if (params?.page) {
		query.set('page', String(params.page));
	}

	if (params?.limit) {
		query.set('limit', String(params.limit));
	}

	if (params?.variant_id) {
		query.set('filter[variant_id]', String(params.variant_id));
	}

	const search = query.toString();

	return await new ApiRequest().doFetch(
		`/public/reviews/${productId}${search ? `?${search}` : ''}`,
		{ method: 'GET' },
	);
}

/**
 * The star widget's numbers, over approved reviews only: how many there are, their average, the
 * spread over whole stars and the average per dimension.
 *
 * Separate from the list because it describes the whole product rather than a page of it - paging
 * through the reviews must not change the score beside them.
 */
export async function requestProductReviewSummary(
	productId: number,
): Promise<ApiResponseFetch<ReviewSummaryType>> {
	return await new ApiRequest().doFetch(
		`/public/reviews/${productId}/summary`,
		{ method: 'GET' },
	);
}

/**
 * Writes a review. It lands awaiting moderation whoever writes it - a review is a lasting claim
 * about something being sold - so it will not appear in the list until somebody passes it, and the
 * response carries `status` so the caller can say so.
 *
 * A second review of the same product answers 409: one live review per buyer per product, revised
 * through `requestUpdateOwnReview` instead.
 */
export async function requestCreateReview(params: {
	product_id: number;
	variant_id?: number;
	rating: ReviewRating;
	content: string;
}): Promise<ApiResponseFetch<ReviewOwnModel>> {
	return await new ApiRequest().doFetch('/public/reviews', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Revises the reader's own review, addressed by product rather than by id - one live review per
 * buyer per product, so the path plus the session names exactly one row.
 *
 * Answers 404 for a product the caller never reviewed, and 403 for anything past `pending`: once a
 * moderator has decided, that text is the record their decision was taken against.
 */
export async function requestUpdateOwnReview(
	productId: number,
	params: { rating?: ReviewRating; content?: string },
): Promise<ApiResponseFetch<ReviewOwnModel>> {
	return await new ApiRequest().doFetch(`/public/reviews/${productId}`, {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}

/**
 * Withdraws the reader's own review, and only while it is still `pending` - a review a moderator
 * has decided on answers 403, the same as a revision does.
 *
 * Soft on the backend, and withdrawing a pending review frees the slot, so the same buyer may
 * write a new one afterwards.
 */
export async function requestDeleteOwnReview(
	productId: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/public/reviews/${productId}`, {
		method: 'DELETE',
	});
}
