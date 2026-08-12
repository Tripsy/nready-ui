import { ApiRequest } from '@/helpers/api.helper';
import type { CmrModel } from '@/models/cmr.model';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import type { LogHistoryModel } from '@/models/log-history.model';
import type { WorkSessionModel } from '@/models/work-session.model';
import type { ApiResponseFetch } from '@/types/api.type';

export async function requestStatsRecentActivity(): Promise<
	LogHistoryModel[] | null
> {
	const response: ApiResponseFetch<LogHistoryModel[]> =
		await new ApiRequest().doFetch('/stats/recent-activity', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(response?.message ?? 'Failed to fetch recent activity');
	}

	return response.data ?? null;
}

export async function requestStatsActiveWorkSessions(): Promise<
	WorkSessionModel[] | null
> {
	const response: ApiResponseFetch<WorkSessionModel[]> =
		await new ApiRequest().doFetch('/stats/active-work-sessions', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to fetch active work sessions',
		);
	}

	return response.data ?? null;
}

type ResponseStatsLatestCMRs = CmrModel & {
	cmr_sessions: CmrSessionModel[];
};

export async function requestStatsLatestCMRs(): Promise<
	ResponseStatsLatestCMRs[] | null
> {
	const response: ApiResponseFetch<ResponseStatsLatestCMRs[]> =
		await new ApiRequest().doFetch('/stats/latest-cmrs', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(response?.message ?? 'Failed to fetch latest CMRs');
	}

	return response.data ?? null;
}

type ResponseStatsTrending = {
	value: number;
	trend: 'up' | 'down';
	change: number;
};

export async function requestStatsCountCMRs(): Promise<ResponseStatsTrending | null> {
	const response: ApiResponseFetch<ResponseStatsTrending> =
		await new ApiRequest().doFetch('/stats/count-cmrs', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to retrieve CMR trending data',
		);
	}

	return response.data ?? null;
}

export async function requestStatsCountWorkingHours(): Promise<ResponseStatsTrending | null> {
	const response: ApiResponseFetch<ResponseStatsTrending> =
		await new ApiRequest().doFetch('/stats/count-working-hours', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ??
				'Failed to retrieve working hours trending data',
		);
	}

	return response.data ?? null;
}

export async function requestStatsDriverCountCMRs(): Promise<ResponseStatsTrending | null> {
	const response: ApiResponseFetch<ResponseStatsTrending> =
		await new ApiRequest().doFetch('/stats/driver-count-cmrs', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to retrieve driver CMR trending data',
		);
	}

	return response.data ?? null;
}

export async function requestStatsDriverCountWorkingHours(): Promise<ResponseStatsTrending | null> {
	const response: ApiResponseFetch<ResponseStatsTrending> =
		await new ApiRequest().doFetch('/stats/driver-count-working-hours', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ??
				'Failed to retrieve driver working hours trending data',
		);
	}

	return response.data ?? null;
}

export async function requestStatsSumExpenses(): Promise<ResponseStatsTrending | null> {
	const response: ApiResponseFetch<ResponseStatsTrending> =
		await new ApiRequest().doFetch('/stats/sum-expenses', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to retrieve expenses trending data',
		);
	}

	return response.data ?? null;
}

export async function requestStatsSumRevenues(): Promise<ResponseStatsTrending | null> {
	const response: ApiResponseFetch<ResponseStatsTrending> =
		await new ApiRequest().doFetch('/stats/sum-revenues', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to retrieve revenues trending data',
		);
	}

	return response.data ?? null;
}
