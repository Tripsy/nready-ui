import { ApiRequest, resolveRequestPath } from '@/helpers/api.helper';
import type { ComplaintModel } from '@/models/complaint.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * The moderation decision on a complaint, and its reversal.
 *
 * Not one of the generic helpers in `services.helper.ts`: `requestUpdateStatus` addresses a status
 * enum in the path, and a complaint's state is a boolean. The direction is the endpoint rather than
 * a field in the body — the backend validates a required boolean as "must be true", so a body
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
