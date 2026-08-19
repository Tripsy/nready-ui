'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getResponseData } from '@/helpers/api.helper';
import type {
	RatingEntityType,
	RatingSummaryListType,
} from '@/models/rating.model';
import { requestRatingSummaryList } from '@/services/rating.service';

/**
 * The reaction counts for a list of targets, in one request.
 *
 * A list issues this once for the ids it is showing rather than once per row, which is the whole
 * reason the bulk endpoint exists. The key carries the ids, so paging in more rows fetches their
 * counts without discarding the ones already on screen.
 *
 * `staleTime: 0` against the provider's five-minute default: `own` is scoped to this visitor, and
 * a count is the one thing a reader checks immediately after reacting — a cached answer reads as
 * the click having failed.
 */
export function useRatingSummaries(
	entityType: RatingEntityType,
	entityIds: number[],
) {
	const queryClient = useQueryClient();

	// Sorted so two lists holding the same rows in a different order share one cache entry.
	const key = [...entityIds]
		.sort((first, second) => first - second)
		.join(',');

	const { data } = useQuery({
		queryKey: ['rating', entityType, key],
		queryFn: async () => {
			const response = await requestRatingSummaryList(
				entityType,
				entityIds,
			);

			return getResponseData<RatingSummaryListType>(response) ?? null;
		},
		enabled: entityIds.length > 0,
		staleTime: 0,
	});

	/*
	 * Every rating query, not just this list's: a reaction cast on a comment also appears in the
	 * replies list below it when that comment is a parent, and the two are separate entries.
	 */
	const onRatingChanged = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['rating'] });
	}, [queryClient]);

	return { ratings: data ?? undefined, onRatingChanged };
}
