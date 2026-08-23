import { ApiRequest } from '@/helpers/api.helper';
import type {
	CommentEntityType,
	CommentLocationModel,
	CommentModel,
	CommentStatus,
	CommentSubscriptionModel,
	CommentSubscriptionType,
} from '@/models/comment.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The reader-facing comment endpoints (`/public/comments`), open to guests and members alike.
 *
 * All four go through `/api/proxy` (the default request mode) rather than `remote-api`, and not
 * only because a browser cannot reach the backend directly: the backend decides *whose* comment a
 * request speaks for from the session it carries and the origin address in `X-Forwarded-For`, both
 * of which the proxy attaches. A `remote-api` call from a server component would arrive as this
 * app's container, and every visitor would share one identity — enough to edit each other's
 * comments.
 *
 * The thread read is cacheable in principle (it returns approved rows only, the same for
 * everyone), but the write endpoints are not: what they return is the caller's own row.
 */

export type CommentThreadType = {
	entries: CommentModel[];
	pagination: { page: number; limit: number; total: number };
	/**
	 * The earliest reply under each root on this page, keyed by the comment it answers — a thread
	 * shows its first reply without being unrolled, and this is what spares one request per root
	 * to find it. Empty when reading a reply list, which is already replies.
	 */
	first_replies: Record<number, CommentModel>;
};

/**
 * One level of a thread. `parent_id` picks which: omitted reads the root comments, given reads
 * the replies under that one. Pinned comments lead the page whatever the ordering.
 */
export async function requestCommentThread(
	entityType: CommentEntityType,
	entityId: number,
	params?: { parent_id?: number; page?: number; limit?: number },
): Promise<ApiResponseFetch<CommentThreadType>> {
	const query = new URLSearchParams();

	if (params?.parent_id) {
		query.set('filter[parent_id]', String(params.parent_id));
	}

	if (params?.page) {
		query.set('page', String(params.page));
	}

	if (params?.limit) {
		query.set('limit', String(params.limit));
	}

	const search = query.toString();

	return await new ApiRequest().doFetch(
		`/public/comments/${entityType}/${entityId}${search ? `?${search}` : ''}`,
		{ method: 'GET' },
	);
}

/**
 * Posts a comment. It lands awaiting moderation, so it will not appear in a thread read until a
 * moderator approves it — the response carries `status` so the caller can say so.
 *
 * A signed-in visitor is identified by their session and the guest fields are ignored; a guest
 * must send `guest_name` and `guest_email` or the backend answers 400.
 */
export async function requestCreateComment(params: {
	entity_type: CommentEntityType;
	entity_id: number;
	content: string;
	type?: string;
	parent_id?: number;
	guest_name?: string;
	guest_email?: string;
	guest_website?: string;
}): Promise<ApiResponseFetch<CommentModel>> {
	return await new ApiRequest().doFetch('/public/comments', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Edits the visitor's own comment — only the text, and only while it is `pending` or `approved`.
 * Once a moderator has rejected, spammed or flagged it the backend answers 400: that text is the
 * record their decision was taken against.
 *
 * Answers 404 for a comment the caller does not own, which is the same answer an id that never
 * existed gives.
 */
export async function requestUpdateComment(
	id: number,
	params: { content: string },
): Promise<ApiResponseFetch<CommentModel>> {
	return await new ApiRequest().doFetch(`/public/comments/${id}`, {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}

/**
 * Withdraws the visitor's own comment. The row is removed outright — the table has no soft
 * delete — and its replies go with it.
 */
export async function requestDeleteComment(
	id: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/public/comments/${id}`, {
		method: 'DELETE',
	});
}

/**
 * The moderation endpoints (`/comments`), reached from the article page by a staff reader so a
 * comment can be dealt with where it is read rather than only from the dashboard.
 *
 * These are the **dashboard** routes, not the public ones: each is permission-gated backend-side
 * (`comment.update` / `comment.delete`, and an admin passes everything). The permission checks in
 * the UI decide what to *offer* — they are not what makes any of this safe, and a reader without
 * the permission gets a 403 whatever the menu showed.
 *
 * They go through `/api/proxy` like every other write, which is what attaches the session.
 */

/** Rewrites another reader's comment, or pins it. A partial update — send only what changes. */
export async function requestModerateComment(
	id: number,
	params: { content?: string; is_pinned?: boolean },
): Promise<ApiResponseFetch<CommentModel>> {
	return await new ApiRequest().doFetch(`/comments/${id}`, {
		method: 'PUT',
		body: JSON.stringify(params),
	});
}

/**
 * Removes a comment outright. The table has no soft delete and `parent_id` cascades, so the whole
 * thread under it goes too — which is why the control behind this confirms first.
 */
export async function requestModerateDeleteComment(
	id: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/comments/${id}`, {
		method: 'DELETE',
	});
}

/**
 * The moderation decision. Only the moves `COMMENT_STATUS_TRANSITIONS` allows from the comment's
 * current state are accepted — from the article page that is always `approved`, since a public
 * thread returns nothing else, so this is how a comment is taken *off* the page. Putting one back
 * on it is the dashboard's job, where the pending queue is visible.
 *
 * `moderation_reason` describes the state the comment is in now and is overwritten on each
 * decision; the backend caps it and accepts its absence.
 */
export async function requestModerateCommentStatus(
	id: number,
	status: CommentStatus,
	moderationReason?: string,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(`/comments/${id}/status/${status}`, {
		method: 'PATCH',
		body: JSON.stringify(
			moderationReason ? { moderation_reason: moderationReason } : {},
		),
	});
}

/**
 * The subscription behind an unsubscribe link, and the preference change the landing page makes.
 *
 * The token in the path is the whole credential — a guest subscriber holds no session — which is
 * why the read runs `remote-api` from the server component that renders the page: there is no
 * session for the proxy to attach, and the answer must not be cached, since it is one row
 * belonging to whoever holds that link.
 */
export async function requestCommentSubscription(
	token: string,
): Promise<ApiResponseFetch<CommentSubscriptionModel>> {
	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/comment-subscriptions/${token}`, {
			method: 'GET',
			cache: 'no-store',
		});
}

/** Changes what the subscriber hears about — `unsubscribed` included, which is the opt-out. */
export async function requestUpdateCommentSubscription(
	token: string,
	notificationType: CommentSubscriptionType,
): Promise<ApiResponseFetch<{ notification_type: CommentSubscriptionType }>> {
	return await new ApiRequest().doFetch(
		`/public/comment-subscriptions/${token}`,
		{
			method: 'PUT',
			body: JSON.stringify({ notification_type: notificationType }),
		},
	);
}

/**
 * Where one comment lives (`GET /public/comments/:id`) — the target it hangs from and the comment
 * it answers, which is everything the permalink page needs to build an address for it.
 *
 * Server-side through `remote-api`, and uncached: it is read once, when somebody follows a link
 * out of an email, and a comment that has been rejected or removed since must answer 404 rather
 * than from a cache.
 */
export async function requestCommentLocation(
	id: number,
): Promise<ApiResponseFetch<CommentLocationModel>> {
	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/comments/${id}`, {
			method: 'GET',
			cache: 'no-store',
		});
}
