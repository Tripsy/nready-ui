import { ApiRequest } from '@/helpers/api.helper';
import type { LogHistoryModel } from '@/models/log-history.model';
import type { ApiResponseFetch } from '@/types/api.type';

/**
 * Dashboard widgets read from a `stats` feature on the backend. `nready-api` does not ship
 * one yet, so these endpoints answer 404 and the widgets render their error state — the
 * wiring is here so a backend `stats` feature drops straight in.
 */

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

type ResponseStatsTrending = {
	value: number;
	trend: 'up' | 'down';
	change: number;
};

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
