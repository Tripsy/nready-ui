import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type {
	ComplaintEntityType,
	ComplaintModel,
	ComplaintOwnEntryType,
	ComplaintPublicReadType,
	ComplaintReason,
} from '@/models/complaint.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The moderation decision on a complaint, and its reversal.
 *
 * Not one of the generic helpers in `services.helper.ts`: `requestUpdateStatus` addresses a status
 * enum in the path, and a complaint's state is a boolean. The direction is the endpoint rather than
 * a field in the body - the backend validates a required boolean as "must be true", so a body
 * carrying `false` could never pass.
 */
export async function requestResolveComplaint(
	entry: ComplaintModel,
	isResolved: boolean,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('complaint')}/${entry.id}/${isResolved ? 'resolve' : 'reopen'}`,
		{ method: 'PATCH' },
	);
}

/**
 * The reader-facing complaint endpoints (`/public/complaints`). Unlike ratings and comments there
 * is no guest path - `user_id` is `NOT NULL` on the table, so every one of these answers 401 to a
 * caller without a session, and the widget asks for a sign-in rather than sending the request.
 *
 * All four go through `/api/proxy` (the default request mode): the backend reads *whose* complaint
 * a request is from the session the proxy attaches, and the answer is per-account, so none of it
 * is cacheable anywhere shared.
 */

/** The target's path segments, in the order the three addressed routes take them. */
function buildComplaintTargetPath(
	entityType: ComplaintEntityType,
	entityId: number,
): string {
	return `/public/complaints/${entityType}/${entityId}`;
}

/**
 * What this reader already filed against the target, or `own: null`. Read before offering the
 * form, so a reader who reported once is shown their complaint instead of walking into the 409
 * `create` answers on a second filing.
 */
export async function requestOwnComplaint(
	entityType: ComplaintEntityType,
	entityId: number,
): Promise<ApiResponseFetch<ComplaintPublicReadType>> {
	return await new ApiRequest().doFetch(
		buildComplaintTargetPath(entityType, entityId),
		{ method: 'GET' },
	);
}

/**
 * Files a complaint. Strictly an insert - 409 when this reader already holds a live one on the
 * target, which `requestUpdateComplaint` is for.
 */
export async function requestCreateComplaint(params: {
	entity_type: ComplaintEntityType;
	entity_id: number;
	reason: ComplaintReason;
	description?: string;
}): Promise<ApiResponseFetch<ComplaintOwnEntryType>> {
	return await new ApiRequest().doFetch('/public/complaints', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}

/**
 * Amends a complaint already filed. The target addresses the row together with the caller and
 * travels in the path - it is what the complaint *is*, not a field - so the body carries only the
 * reason and the description. Answers 400 once a moderator has resolved it.
 */
export async function requestUpdateComplaint(
	entityType: ComplaintEntityType,
	entityId: number,
	params: { reason?: ComplaintReason; description?: string },
): Promise<ApiResponseFetch<ComplaintOwnEntryType>> {
	return await new ApiRequest().doFetch(
		buildComplaintTargetPath(entityType, entityId),
		{
			method: 'PUT',
			body: JSON.stringify(params),
		},
	);
}

/**
 * Withdraws the reader's complaint. Soft on the backend - what was reported and taken back stays
 * on record - but it releases the slot under `UQ_complaint_user`, so the target can be reported
 * again afterwards.
 */
export async function requestDeleteComplaint(
	entityType: ComplaintEntityType,
	entityId: number,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		buildComplaintTargetPath(entityType, entityId),
		{ method: 'DELETE' },
	);
}
