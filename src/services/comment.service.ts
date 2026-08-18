import { ApiRequest } from '@/helpers/api.helper';
import type { CommentEntityType, CommentModel } from '@/models/comment.model';
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
 * Edits the visitor's own comment — only the text, and only while it is still awaiting
 * moderation. Once approved it is answered 400: the text is what a moderator passed and what
 * readers have already seen.
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
