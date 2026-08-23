'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons } from '@/components/icon.component';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import {
	RATING_LIKE_DOWN,
	RATING_LIKE_UP,
	RatingEntityTypeEnum,
	type RatingPublicReadType,
	RatingTypeEnum,
} from '@/models/rating.model';
import { useToast } from '@/providers/toast.provider';
import {
	requestCreateRating,
	requestDeleteRating,
	requestRatingSummary,
	requestUpdateRating,
} from '@/services/rating.service';

/**
 * A **type** rather than the `as const` key array its server-rendered siblings export: this
 * module is `'use client'`, so Next replaces its value exports with client references and a
 * server component spreading the array would get something that is not iterable. Types are
 * erased, so this one crosses the boundary fine — the page lists the keys itself, the way
 * `ArticleFeed`'s caller does.
 */
export type ArticleRatingTranslations = {
	'text.rating': string;
	'text.rating_up': string;
	'text.rating_down': string;
	'text.rating_failed': string;
};

const ENTITY_TYPE = RatingEntityTypeEnum.ARTICLE;
const RATING_TYPE = RatingTypeEnum.LIKE;

type LikeDirection = typeof RATING_LIKE_UP | typeof RATING_LIKE_DOWN;

export function ArticleRating({
	articleId,
	translations,
}: {
	articleId: number;
	translations: ArticleRatingTranslations;
}) {
	const queryClient = useQueryClient();
	const { showToast } = useToast();

	const queryKey = ['rating', ENTITY_TYPE, articleId];

	/*
	 * `staleTime: 0` against the provider's five-minute default: the response is scoped to
	 * this visitor (`own` is their own vote) and the count is the one thing a reader checks
	 * immediately after clicking, so a cached answer reads as the click having failed. The
	 * backend does not cache it either — `RatingEntity.HAS_CACHE` is false.
	 */
	const { data } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestRatingSummary(ENTITY_TYPE, articleId);

			return getResponseData<RatingPublicReadType>(response) ?? null;
		},
		staleTime: 0,
	});

	const own =
		data?.own.find((entry) => entry.type === RATING_TYPE)?.value ?? null;
	const up = data?.summary.like.up ?? 0;
	const down = data?.summary.like.down ?? 0;

	/*
	 * One button press, three possible writes — which one depends on what the reader already
	 * holds, and the backend refuses the wrong one (409 on a second cast, 404 on changing
	 * nothing), so the branch is not cosmetic.
	 */
	const { mutate, isPending } = useMutation({
		mutationFn: async (direction: LikeDirection) => {
			if (own === null) {
				return requestCreateRating({
					entity_type: ENTITY_TYPE,
					entity_id: articleId,
					type: RATING_TYPE,
					value: direction,
				});
			}

			// Pressing the direction already held takes the vote back rather than casting
			// it twice — the row is removed, freeing the target to be rated again.
			if (own === direction) {
				return requestDeleteRating(ENTITY_TYPE, articleId, RATING_TYPE);
			}

			return requestUpdateRating(ENTITY_TYPE, articleId, RATING_TYPE, {
				value: direction,
			});
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey }),
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['text.rating_failed'],
				// The backend's own wording, which distinguishes this reader having already
				// rated from somebody else at the same address having done so.
				detail: getErrorMessage(error),
			}),
	});

	const buttons: {
		direction: LikeDirection;
		label: string;
		count: number;
		Icon: typeof Icons.RatingUp;
		activeClassName: string;
	}[] = [
		{
			direction: RATING_LIKE_UP,
			label: translations['text.rating_up'],
			count: up,
			Icon: Icons.RatingUp,
			activeClassName: 'bg-accent text-accent-foreground',
		},
		{
			direction: RATING_LIKE_DOWN,
			label: translations['text.rating_down'],
			count: down,
			Icon: Icons.RatingDown,
			activeClassName: 'bg-danger text-danger-foreground',
		},
	];

	return (
		<div className="flex flex-wrap items-center gap-4">
			<span className="text-sm text-muted">
				{translations['text.rating']}
			</span>

			<div className="flex items-center gap-2">
				{buttons.map(
					({ direction, label, count, Icon, activeClassName }) => {
						const isActive = own === direction;

						return (
							<button
								key={direction}
								type="button"
								/*
								 * `aria-pressed` rather than a label that changes with the
								 * state: a screen reader announces the toggle itself, and
								 * the visible label stays the action, not its result.
								 */
								aria-pressed={isActive}
								aria-label={label}
								title={label}
								disabled={isPending}
								onClick={() => mutate(direction)}
								className={cn(
									'flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm transition-colors',
									'disabled:cursor-not-allowed disabled:opacity-60',
									isActive
										? activeClassName
										: 'hover:bg-accent-soft hover:text-accent-soft-foreground',
								)}
							>
								<Icon className="h-4 w-4" />
								<span className="tabular-nums">{count}</span>
							</button>
						);
					},
				)}
			</div>
		</div>
	);
}
