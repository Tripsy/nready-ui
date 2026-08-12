import {
	combineDateAndTime,
	createCurrentDate,
	dateDiff,
	formatDate,
} from '@/helpers/date.helper';
import type { UserModel } from '@/models/user.model';
import type { StatusTransitions } from '@/types/common.type';

export const WorkSessionStatusEnum = {
	ACTIVE: 'active',
	CLOSED: 'closed',
} as const;

export type WorkSessionStatus =
	(typeof WorkSessionStatusEnum)[keyof typeof WorkSessionStatusEnum];

// Allowed status transition configuration
export const STATUS_TRANSITIONS: StatusTransitions<WorkSessionStatus> = {
	[WorkSessionStatusEnum.ACTIVE]: [WorkSessionStatusEnum.CLOSED],
	[WorkSessionStatusEnum.CLOSED]: [],
};

export type WorkSessionModel<D = Date | string> = {
	id: number;

	user: UserModel;

	status: WorkSessionStatus;

	start_at: D;
	end_at: D | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export const START_AT_MAX_PAST_SECONDS = 1800;
export const END_AT_MAX_FUTURE_SECONDS = 1800;

export function displayWorkSessionDuration(entry: WorkSessionModel) {
	const start = new Date(entry.start_at);
	const end = entry.end_at ? new Date(entry.end_at) : createCurrentDate();

	/*
	 * An open session is measured against the viewer's clock while `start_at` came from the
	 * server's, so the two can disagree by a minute; `start_at` may also sit slightly in the
	 * future by design (see END_AT_MAX_FUTURE_SECONDS). Neither means the session has run
	 * for negative time — it has run for none yet.
	 */
	return dateDiff(start, end < start ? start : end, 'display');
}

export function displayWorkSessionLabel(entry: WorkSessionModel) {
	return `${entry.user.name} ${formatDate(entry.start_at, 'date-time')}`;
}

export function determineEndAt(
	start_at: Date,
	start_at_time: string,
	end_at_time: string,
) {
	const isOverMidnight = end_at_time < start_at_time;

	const end_at = new Date(start_at);

	if (isOverMidnight) {
		end_at.setDate(end_at.getDate() + 1);
	}

	return combineDateAndTime(end_at, end_at_time);
}
