import { ApiRequest } from '@/helpers/api.helper';
import type {
	RatingEntityType,
	RatingPublicReadType,
	RatingSummaryListType,
	RatingType,
} from '@/models/rating.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The reader-facing rating endpoints (`/public/ratings`), open to guests and members alike.
 *
 * All four go through `/api/proxy` (the default request mode) rather than `remote-api`, and
 * unlike the public article reads that is not only because a browser cannot reach the backend
 * directly: the backend decides *whose* rating a request is by the session it carries and the
 * origin address in `X-Forwarded-For`, both of which the proxy attaches. A `remote-api` call
 * from a server component would arrive as this app's container, and every visitor would share
 * one vote.
 *
 * For the same reason none of these participate in Next's data cache — the answer is
 * per-visitor, and `own` is nobody else's business.
 */

/** The target's path segments, in the order every route below takes them. */
function buildTargetPath(
	entityType: RatingEntityType,
	entityId: number,
): string {
	return `/public/ratings/${entityType}/${entityId}`;
}

/**
 * The aggregate for one target plus whatever this visitor cast on it.
 */
export async function requestRatingSummary(
	entityType: RatingEntityType,
	entityId: number,
): Promise<ApiResponseFetch<RatingPublicReadType>> {
	return await new ApiRequest().doFetch(
		buildTargetPath(entityType, entityId),
		{ method: 'GET' },
	);
}

/**
 * The aggregates for several targets at once, plus whatever this visitor cast on each.
 *
 * One request for a whole list: a page of comments would otherwise call the single read once per
 * comment. The backend caps how many ids it will answer for, so callers page their list rather
 * than asking about everything they hold.
 */
export async function requestRatingSummaryList(
	entityType: RatingEntityType,
	entityIds: number[],
): Promise<ApiResponseFetch<RatingSummaryListType>> {
	const query = new URLSearchParams({ entity_ids: entityIds.join(',') });

	return await new ApiRequest().doFetch(
		`/public/ratings/${entityType}?${query.toString()}`,
		{ method: 'GET' },
	);
}

/**
 * Casts a rating the visitor does not hold yet. Answers 409 when they already rated this
 * target — or when somebody else behind the same address did, which is a different message
 * and not something the caller can resolve by retrying.
 */
export async function requestCreateRating(params: {
	entity_type: RatingEntityType;
	entity_id: number;
	type: RatingType;
	value?: number;
	reaction?: string;
}): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch('/public/ratings', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Changes a rating already cast. The target and `type` address the row and travel in the
 * path — they are not editable — so the body carries only the new value or reaction.
 * Answers 404 when this visitor holds nothing on the target.
 */
export async function requestUpdateRating(
	entityType: RatingEntityType,
	entityId: number,
	type: RatingType,
	params: { value?: number; reaction?: string },
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`${buildTargetPath(entityType, entityId)}/${type}`,
		{
			method: 'PUT',
			body: JSON.stringify(params),
		},
	);
}

/**
 * Withdraws the visitor's rating of this type. The row is removed outright — the table has no
 * soft delete — so this frees the target up to be rated again.
 */
export async function requestDeleteRating(
	entityType: RatingEntityType,
	entityId: number,
	type: RatingType,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`${buildTargetPath(entityType, entityId)}/${type}`,
		{ method: 'DELETE' },
	);
}
