'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Icons } from '@/components/icon.component';
import type { RatingTranslations } from '@/components/rating/rating.definition';
import { cn } from '@/helpers/css.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import {
	countRatingReactions,
	type RatingEmoji,
	RatingEmojiEnum,
	type RatingEntityType,
	type RatingOwnEntryType,
	type RatingSummaryType,
	RatingTypeEnum,
} from '@/models/rating.model';
import { useToast } from '@/providers/toast.provider';
import {
	requestCreateRating,
	requestDeleteRating,
	requestUpdateRating,
} from '@/services/rating.service';

const RATING_TYPE = RatingTypeEnum.EMOJI;

/**
 * The reaction each icon stands for. Ordered as they are offered, which is why this is a list and
 * not a lookup on the enum: `like` leads because it is what most readers reach for, and the
 * collapsed control wears its icon when nothing has been cast.
 */
const REACTIONS: {
	reaction: RatingEmoji;
	Icon: typeof Icons.RatingUp;
	labelKey: keyof RatingTranslations;
	/** Its own hue, so the five read as distinct marks rather than one grey row. */
	colorClass: string;
}[] = [
	{
		reaction: RatingEmojiEnum.LIKE,
		Icon: Icons.RatingLike,
		labelKey: 'reaction.like',
		colorClass: 'text-amber-500',
	},
	{
		reaction: RatingEmojiEnum.LOVE,
		Icon: Icons.RatingLove,
		labelKey: 'reaction.love',
		colorClass: 'text-rose-500',
	},
	{
		reaction: RatingEmojiEnum.INSIGHTFUL,
		Icon: Icons.RatingInsightful,
		labelKey: 'reaction.insightful',
		colorClass: 'text-violet-500',
	},
	{
		reaction: RatingEmojiEnum.FUNNY,
		Icon: Icons.RatingFunny,
		labelKey: 'reaction.funny',
		colorClass: 'text-emerald-500',
	},
	{
		reaction: RatingEmojiEnum.DISLIKE,
		Icon: Icons.RatingDown,
		labelKey: 'reaction.dislike',
		colorClass: 'text-slate-500',
	},
];

type RatingReactionsProps = {
	entityType: RatingEntityType;
	entityId: number;
	/** Absent when nobody has reacted yet — the target simply has no rows. */
	summary?: RatingSummaryType;
	own?: RatingOwnEntryType[];
	translations: RatingTranslations;
	/** Refetches whatever list the counts came from. */
	onChanged: () => void;
};

/**
 * The reactions on one target: a single control showing what was cast and how many, which opens
 * the picker on hover.
 *
 * Collapsed by design — a row of five icons per comment would compete with the comment. What the
 * control wears is the reader's own reaction when they hold one, so the state is legible without
 * opening anything.
 */
export function RatingReactions({
	entityType,
	entityId,
	summary,
	own,
	translations,
	onChanged,
}: RatingReactionsProps) {
	const { showToast } = useToast();
	const [open, setOpen] = useState(false);

	const ownReaction =
		own?.find((entry) => entry.type === RATING_TYPE)?.reaction ?? null;
	const total = countRatingReactions(summary);

	const close = useCallback(() => setOpen(false), []);

	/*
	 * One press, three possible writes — which one depends on what the reader already holds, and
	 * the backend refuses the wrong one (409 on a second cast, 404 on changing nothing), so the
	 * branch is not cosmetic.
	 */
	const { mutate, isPending } = useMutation({
		mutationFn: async (reaction: RatingEmoji) => {
			if (ownReaction === null) {
				return requestCreateRating({
					entity_type: entityType,
					entity_id: entityId,
					type: RATING_TYPE,
					reaction,
				});
			}

			// Pressing the reaction already held takes it back rather than casting it twice.
			if (ownReaction === reaction) {
				return requestDeleteRating(entityType, entityId, RATING_TYPE);
			}

			return requestUpdateRating(entityType, entityId, RATING_TYPE, {
				reaction,
			});
		},
		onSuccess: () => {
			setOpen(false);
			onChanged();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['reaction.failed'],
				// The backend's own wording, which distinguishes this reader having already
				// rated from somebody else at the same address having done so.
				detail: getErrorMessage(error),
			}),
	});

	const ownEntry = REACTIONS.find((item) => item.reaction === ownReaction);
	const TriggerIcon = ownEntry?.Icon ?? Icons.RatingLike;

	return (
		/*
		 * Hover opens it, focus keeps it open: a picker reachable only by pointer is one a
		 * keyboard cannot use at all, and `onFocus`/`onBlur` bubble in React, so the whole group
		 * reports as one.
		 *
		 * The handlers make this wrapper interactive without a role, which is what the
		 * suppression below answers for: the trigger carries the label and `aria-expanded`, and
		 * every reaction is a button reachable by keyboard, so the wrapper itself announces
		 * nothing. The rule's suggested fix is worse — `role="group"` then trips
		 * `useSemanticElements`, which asks for a `fieldset` around what is not a form.
		 */
		// biome-ignore lint/a11y/noStaticElementInteractions: pointer conveniences over a wrapper whose controls are all real buttons — see above
		<div
			className="relative inline-flex"
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={close}
			onFocus={() => setOpen(true)}
			onBlur={close}
		>
			<button
				type="button"
				aria-expanded={open}
				aria-label={translations['reaction.action']}
				title={ownEntry ? translations[ownEntry.labelKey] : undefined}
				onClick={() => setOpen((current) => !current)}
				className={cn(
					'flex items-center gap-1 transition-colors',
					// A reaction already cast keeps its color on hover: darkening it would
					// read as the choice being cleared, which is what clicking it does.
					ownEntry ? ownEntry.colorClass : 'hover:text-foreground',
				)}
			>
				<TriggerIcon className="h-4 w-4" />
				<span className="tabular-nums">{total}</span>
			</button>

			{open && (
				/*
				 * Anchored over the trigger rather than above it with a gap between: the two
				 * then share an edge, so there is no dead space for the pointer to cross on
				 * its way to a reaction — which is what used to close the picker mid-reach.
				 * It covers the trigger while open, and the trigger has nothing to do at that
				 * point but stay put.
				 */
				<div className="absolute bottom-0 left-0 z-10 flex items-center gap-6 rounded-full border border-line bg-surface px-5 py-3 shadow-lg">
					{REACTIONS.map(
						({ reaction, Icon, labelKey, colorClass }) => {
							const count = summary?.emoji[reaction] ?? 0;
							const isOwn = ownReaction === reaction;

							return (
								<button
									key={reaction}
									type="button"
									aria-pressed={isOwn}
									aria-label={translations[labelKey]}
									title={translations[labelKey]}
									disabled={isPending}
									onClick={() => mutate(reaction)}
									className={cn(
										'flex items-center gap-1 transition-transform duration-150',
										'hover:scale-160 focus-visible:scale-160',
										'disabled:cursor-not-allowed disabled:opacity-60',
										colorClass,
										// The one already cast sits a little proud of the rest,
										// so the current choice reads while picking.
										isOwn && 'scale-110',
									)}
								>
									<Icon className="h-6 w-6" />
									{/*
									 * Shown even at zero, so the row keeps its width as
									 * reactions arrive rather than shifting the icons under
									 * the pointer that is picking one.
									 */}
									<span className="text-xs tabular-nums text-muted">
										{count}
									</span>
								</button>
							);
						},
					)}
				</div>
			)}
		</div>
	);
}
