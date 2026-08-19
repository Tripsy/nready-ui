'use client';

import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { CommentTranslations } from '@/components/comment/comment.definition';
import { CommentForm } from '@/components/comment/comment-form.component';
import { Icons } from '@/components/icon.component';
import type { RatingTranslations } from '@/components/rating/rating.definition';
import { RatingReactions } from '@/components/rating/rating-reactions.component';
import { showAvatar } from '@/components/ui/avatar.component';
import { getResponseData } from '@/helpers/api.helper';
import { formatRelativeDate } from '@/helpers/date.helper';
import { useRatingSummaries } from '@/hooks/use-rating-summaries.hook';
import type { CommentEntityType, CommentModel } from '@/models/comment.model';
import {
	RatingEntityTypeEnum,
	type RatingSummaryListType,
} from '@/models/rating.model';
import {
	type CommentThreadType,
	requestCommentThread,
} from '@/services/comment.service';

const PAGE_SIZE = 10;

/**
 * The whole thread's query keys. Roots and each parent's replies are separate entries — they are
 * separate requests — but everything under one target shares the `[.., entityType, entityId]`
 * prefix, so a new comment anywhere invalidates the lot with one call.
 */
function threadKey(
	entityType: CommentEntityType,
	entityId: number,
	parentId: number | null = null,
) {
	return ['comment', entityType, entityId, parentId ?? 'roots'] as const;
}

async function fetchThread(
	entityType: CommentEntityType,
	entityId: number,
	parentId: number | null,
	page: number,
): Promise<CommentThreadType> {
	const response = await requestCommentThread(entityType, entityId, {
		...(parentId ? { parent_id: parentId } : {}),
		page,
		limit: PAGE_SIZE,
	});

	const data = getResponseData<CommentThreadType>(response);

	if (!response?.success || !data) {
		throw new Error('Could not retrieve the comment thread');
	}

	return data;
}

/**
 * One parent's replies. A plain query rather than an infinite one: a reply list is opened
 * deliberately and is short, so it is read whole or not at all.
 */
function useReplies(
	entityType: CommentEntityType,
	entityId: number,
	parentId: number | null,
) {
	return useQuery({
		queryKey: threadKey(entityType, entityId, parentId),
		queryFn: () => fetchThread(entityType, entityId, parentId as number, 1),
		enabled: parentId !== null,
	});
}

/** The author line: the account behind the comment, or the name a guest signed it with. */
function commentAuthor(
	entry: CommentModel,
	translations: CommentTranslations,
): string {
	return entry.user?.name ?? entry.guest_name ?? translations['thread.guest'];
}

function CommentEntry({
	entry,
	entityType,
	entityId,
	previewReply,
	translations,
	ratingTranslations,
	ratings,
	onRatingChanged,
	onPosted,
}: {
	entry: CommentModel;
	entityType: CommentEntityType;
	entityId: number;
	/** Shown under this comment while its thread is collapsed; absent when it has no replies. */
	previewReply?: CommentModel;
	translations: CommentTranslations;
	ratingTranslations: RatingTranslations;
	/**
	 * The reaction counts for the whole list this comment was rendered in, fetched once by that
	 * list. Each row reads its own slice rather than asking for it.
	 */
	ratings?: RatingSummaryListType;
	onRatingChanged: () => void;
	onPosted: () => void;
}) {
	const [showReplies, setShowReplies] = useState(false);
	const [showReplyForm, setShowReplyForm] = useState(false);

	// Replies are fetched only once opened: most threads are read, not unrolled, and a page of
	// roots would otherwise cost one request per root on arrival.
	const { data, isLoading } = useReplies(
		entityType,
		entityId,
		showReplies ? entry.id : null,
	);

	const replies = data?.entries ?? [];

	// The replies are their own list, so they carry their own counts — one request for all of
	// them, issued only once the thread is opened.
	const { ratings: replyRatings, onRatingChanged: onReplyRatingChanged } =
		useRatingSummaries(
			RatingEntityTypeEnum.COMMENT,
			replies.map((reply) => reply.id),
		);

	const closeReplyForm = useCallback(() => setShowReplyForm(false), []);

	const onReplyPosted = useCallback(() => {
		setShowReplyForm(false);
		onPosted();
	}, [onPosted]);

	const author = commentAuthor(entry, translations);

	// The count belongs to a thread, and only a root starts one — under a reply it would be a
	// second number next to the first, counting something the reader cannot open from there.
	const isRoot = entry.parent_id === null;

	/*
	 * The first reply is already on screen, so the controls only appear once there is a second
	 * one to reach: a thread of exactly one reply has nothing to expand and nothing to collapse.
	 */
	const hasMoreReplies = isRoot && entry.reply_count > 1;

	return (
		<li className="py-5">
			<div className="flex gap-3">
				{showAvatar(author, { link: entry.user?.avatar })}

				{/* `min-w-0` so a long unbroken word wraps instead of widening the row. */}
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<span className="font-medium">{author}</span>

						{entry.is_staff && (
							<span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-soft-foreground">
								{translations['thread.staff']}
							</span>
						)}

						{entry.is_pinned && (
							<span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
								{translations['thread.pinned']}
							</span>
						)}

						<time
							dateTime={String(entry.created_at)}
							className="text-muted"
						>
							{formatRelativeDate(entry.created_at)}
						</time>
					</div>

					{/*
					 * Plain text, deliberately: the body is whatever a visitor typed, and
					 * rendering it as markdown would put their formatting — and anything an
					 * injection survives — into the page. `whitespace-pre-line` keeps the
					 * paragraph breaks they intended.
					 */}
					<p className="mt-2 whitespace-pre-line text-foreground">
						{entry.content}
					</p>

					{/*
					 * The icon is the reply action; the number beside it is how many replies
					 * this thread already holds. Opening them is a separate control below —
					 * one button cannot both answer a comment and unroll it.
					 */}
					<div className="mt-3 flex items-center gap-4 text-sm text-muted">
						{/*
						 * Icon and count as one group, and the button is a flex box: a bare
						 * `svg` inside a button sits on the text baseline, which left it a
						 * couple of pixels below the reaction icon beside it.
						 */}
						<span className="inline-flex items-center gap-1.5">
							<button
								type="button"
								onClick={() =>
									setShowReplyForm((open) => !open)
								}
								aria-expanded={showReplyForm}
								aria-label={translations['thread.reply']}
								title={translations['thread.reply']}
								className="flex items-center transition-colors hover:text-foreground"
							>
								<Icons.Comment className="h-4 w-4" />
							</button>

							{isRoot && (
								<span
									className="tabular-nums"
									title={translations['thread.replies']}
								>
									{entry.reply_count}
								</span>
							)}
						</span>

						<RatingReactions
							entityType={RatingEntityTypeEnum.COMMENT}
							entityId={entry.id}
							summary={ratings?.summaries[entry.id]}
							own={ratings?.own[entry.id]}
							translations={ratingTranslations}
							onChanged={onRatingChanged}
						/>
					</div>

					{hasMoreReplies && !showReplies && (
						<button
							type="button"
							onClick={() => setShowReplies(true)}
							className="mt-2 text-sm text-accent hover:underline"
						>
							{translations['thread.see_replies']}
						</button>
					)}

					{showReplyForm && (
						<div className="mt-4 border-l border-line pl-4">
							<p className="text-sm text-muted">
								{translations['thread.reply_to']} {author}
							</p>

							<CommentForm
								entityType={entityType}
								entityId={entityId}
								parentId={entry.id}
								translations={translations}
								onSuccess={onReplyPosted}
								onCancel={closeReplyForm}
							/>
						</div>
					)}

					{/*
					 * The thread's rail. It is pulled back to sit under the middle of this
					 * comment's avatar — the content column starts past the avatar (32px) and
					 * the gap (12px), so -28px lands the border on the avatar's centre line,
					 * and the padding then holds the replies clear of it.
					 */}
					{showReplies ? (
						<>
							<ul className="-ml-7 mt-4 border-l border-line pl-4">
								{isLoading ? (
									<li className="py-2 text-sm text-muted">
										{translations['thread.loading']}
									</li>
								) : (
									replies.map((reply) => (
										<CommentEntry
											key={reply.id}
											entry={reply}
											entityType={entityType}
											entityId={entityId}
											translations={translations}
											ratingTranslations={
												ratingTranslations
											}
											ratings={replyRatings}
											onRatingChanged={
												onReplyRatingChanged
											}
											onPosted={onPosted}
										/>
									))
								)}
							</ul>

							{/*
							 * Below the replies rather than beside "See replies": after a long
							 * thread the way out should be where the reading stopped, not back
							 * up at the top.
							 */}
							<button
								type="button"
								onClick={() => setShowReplies(false)}
								className="mt-2 text-sm text-accent hover:underline"
							>
								{translations['thread.collapse_replies']}
							</button>
						</>
					) : (
						previewReply && (
							<ul className="-ml-7 mt-4 border-l border-line pl-4">
								<CommentEntry
									entry={previewReply}
									entityType={entityType}
									entityId={entityId}
									translations={translations}
									ratingTranslations={ratingTranslations}
									// The roots request covers the previews too, so this reply's
									// counts arrived with its parent's.
									ratings={ratings}
									onRatingChanged={onRatingChanged}
									onPosted={onPosted}
								/>
							</ul>
						)
					)}
				</div>
			</div>
		</li>
	);
}

/**
 * A target's discussion: the approved root comments, their replies on demand, and the box to add
 * one. Nothing here knows what it is attached to beyond `entityType` / `entityId`, so an article
 * and a review render the same section.
 *
 * Client-rendered against the public endpoint rather than fetched with the host page: those pages
 * are served from a data cache, and a comment approved in the meantime would not appear until that
 * window passed.
 */
export function CommentThread({
	entityType,
	entityId,
	translations,
	ratingTranslations,
}: {
	entityType: CommentEntityType;
	entityId: number;
	translations: CommentTranslations;
	ratingTranslations: RatingTranslations;
}) {
	const queryClient = useQueryClient();

	/*
	 * Accumulating rather than paging: "load more" appends to a discussion the reader is part
	 * way through, and replacing the page under them would lose the thread they had opened.
	 */
	const {
		data,
		isLoading,
		isError,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	} = useInfiniteQuery({
		queryKey: threadKey(entityType, entityId),
		queryFn: ({ pageParam }) =>
			fetchThread(entityType, entityId, null, pageParam),
		initialPageParam: 1,
		getNextPageParam: (lastPage, pages) => {
			const total = lastPage.pagination?.total ?? 0;
			const loaded = pages.reduce(
				(count, page) => count + page.entries.length,
				0,
			);

			return loaded < total ? pages.length + 1 : undefined;
		},
	});

	/*
	 * A posted comment lands `pending`, so nothing here changes yet — the refetch is for the
	 * case that matters: a reply whose parent's `reply_count` moved because a moderator
	 * approved something while this page was open.
	 */
	const onPosted = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: ['comment', entityType, entityId],
		});
	}, [queryClient, entityType, entityId]);

	const entries = data?.pages.flatMap((page) => page.entries) ?? [];

	/*
	 * The first reply under each root, which the backend resolves alongside the page so a thread
	 * can show one without being unrolled — and without a request per root to find it.
	 */
	const firstReplies = Object.assign(
		{},
		...(data?.pages.map((page) => page.first_replies ?? {}) ?? []),
	) as Record<number, CommentModel>;

	/*
	 * One request for everything on screen, previews included, re-keyed as more is paged in —
	 * a preview reply carries its own reactions and would otherwise fetch them on its own.
	 */
	const { ratings, onRatingChanged } = useRatingSummaries(
		RatingEntityTypeEnum.COMMENT,
		[
			...entries.map((entry) => entry.id),
			...Object.values(firstReplies).map((reply) => reply.id),
		],
	);
	const total = data?.pages[0]?.pagination?.total ?? 0;

	return (
		<section className="mt-10 border-t border-line pt-8">
			<h2 className="text-xl font-semibold">
				{translations['thread.heading']}
				{total > 0 && (
					<span className="ml-2 text-base font-normal text-muted tabular-nums">
						{total}
					</span>
				)}
			</h2>

			{isError ? (
				<p className="mt-4 text-sm text-muted">
					{translations['thread.unavailable']}
				</p>
			) : isLoading ? (
				<p className="mt-4 text-sm text-muted">
					{translations['thread.loading']}
				</p>
			) : entries.length === 0 ? (
				<p className="mt-4 text-sm text-muted">
					{translations['thread.empty']}
				</p>
			) : (
				<ul className="mt-4">
					{entries.map((entry) => (
						<CommentEntry
							key={entry.id}
							entry={entry}
							entityType={entityType}
							entityId={entityId}
							previewReply={firstReplies[entry.id]}
							translations={translations}
							ratingTranslations={ratingTranslations}
							ratings={ratings}
							onRatingChanged={onRatingChanged}
							onPosted={onPosted}
						/>
					))}
				</ul>
			)}

			{hasNextPage && (
				<button
					type="button"
					onClick={() => void fetchNextPage()}
					disabled={isFetchingNextPage}
					className="mt-4 rounded-full border border-line px-4 py-1.5 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground disabled:opacity-60"
				>
					{isFetchingNextPage
						? translations['thread.loading']
						: translations['thread.load_more']}
				</button>
			)}

			<div className="mt-8 border-t border-line pt-6">
				<h3 className="text-base font-semibold">
					{translations['form.heading']}
				</h3>

				<CommentForm
					entityType={entityType}
					entityId={entityId}
					translations={translations}
					onSuccess={onPosted}
				/>
			</div>
		</section>
	);
}
