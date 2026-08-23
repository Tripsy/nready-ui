import { ApiRequest } from '@/helpers/api.helper';
import type { LogHistoryModel } from '@/models/log-history.model';
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

export type ResponseStatsRecentCounts = {
	user: number;
	client: number;
	article: number;
	comment: number;
	complaint: number;
};

export async function requestStatsRecentCounts(): Promise<ResponseStatsRecentCounts | null> {
	const response: ApiResponseFetch<ResponseStatsRecentCounts> =
		await new ApiRequest().doFetch('/stats/recent-counts', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to retrieve recent counts',
		);
	}

	return response.data ?? null;
}

export const PENDING_REVIEW_ENTITIES = [
	'user',
	'client',
	'article',
	'comment',
	'complaint',
] as const;

export type PendingReviewEntity = (typeof PENDING_REVIEW_ENTITIES)[number];

export type PendingReviewEntry = {
	id: number;
	label: string | null;
	created_at: string;
};

/** `total` is the real backlog; `entries` is capped by the backend. */
export type PendingReviewGroup = {
	entries: PendingReviewEntry[];
	total: number;
};

export type ResponseStatsPendingReview = Record<
	PendingReviewEntity,
	PendingReviewGroup
>;

export async function requestStatsPendingReview(): Promise<ResponseStatsPendingReview | null> {
	const response: ApiResponseFetch<ResponseStatsPendingReview> =
		await new ApiRequest().doFetch('/stats/pending-review', {
			method: 'GET',
		});

	if (!response?.success) {
		throw new Error(
			response?.message ?? 'Failed to retrieve items awaiting review',
		);
	}

	return response.data ?? null;
}
