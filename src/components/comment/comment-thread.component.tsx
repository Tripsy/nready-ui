'use client';

import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
	type CommentAnchorType,
	type CommentTranslations,
	commentAnchorId,
	parseCommentAnchor,
	resolveCommentAbilities,
} from '@/components/comment/comment.definition';
import { CommentBody } from '@/components/comment/comment-body.component';
import { CommentEdit } from '@/components/comment/comment-edit.component';
import { CommentForm } from '@/components/comment/comment-form.component';
import { CommentMenu } from '@/components/comment/comment-menu.component';
import type { ComplaintTranslations } from '@/components/complaint/complaint.definition';
import { Icons } from '@/components/icon.component';
import type { RatingTranslations } from '@/components/rating/rating.definition';
import { RatingReactions } from '@/components/rating/rating-reactions.component';
import { showAvatar } from '@/components/ui/avatar.component';
import { Button } from '@/components/ui/button';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import { formatRelativeDate } from '@/helpers/date.helper';
import { useRatingSummaries } from '@/hooks/use-rating-summaries.hook';
import type { CommentEntityType, CommentModel } from '@/models/comment.model';
import {
	RatingEntityTypeEnum,
	type RatingSummaryListType,
} from '@/models/rating.model';
import { useAuth } from '@/providers/auth.provider';
import {
	type CommentThreadType,
	requestCommentThread,
} from '@/services/comment.service';
import type { Language } from '@/types/common.type';

const PAGE_SIZE = 10;

/**
 * How long the thread keeps looking for a comment a link named, in attempts of `ANCHOR_RETRY_MS`
 * each - long enough to page through a busy thread and open a reply list, short enough that a
 * dead link stops costing anything.
 */
const ANCHOR_RETRY_MS = 300;
const ANCHOR_MAX_ATTEMPTS = 20;

/**
 * The whole thread's query keys. Roots and each parent's replies are separate entries - they are
 * separate requests - but everything under one target shares the `[.., entityType, entityId]`
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
	language,
	previewReply,
	translations,
	ratingTranslations,
	complaintTranslations,
	ratings,
	onRatingChanged,
	onPosted,
	openRepliesFor,
	highlightedAnchor,
}: {
	entry: CommentModel;
	entityType: CommentEntityType;
	entityId: number;
	/** The reader's language, for the posted-at date - see `formatRelativeDate`. */
	language: Language;
	/** Shown under this comment while its thread is collapsed; absent when it has no replies. */
	previewReply?: CommentModel;
	translations: CommentTranslations;
	ratingTranslations: RatingTranslations;
	complaintTranslations: ComplaintTranslations;
	/**
	 * The reaction counts for the whole list this comment was rendered in, fetched once by that
	 * list. Each row reads its own slice rather than asking for it.
	 */
	ratings?: RatingSummaryListType;
	onRatingChanged: () => void;
	onPosted: () => void;
	/** The thread a link asked for, which this comment unrolls when the link named it. */
	openRepliesFor?: number | null;
	/** The comment a link led to, marked until the reader looks away from it. */
	highlightedAnchor?: string | null;
}) {
	const { auth } = useAuth();

	const [showReplies, setShowReplies] = useState(false);
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const abilities = resolveCommentAbilities(auth, entry);

	const startEdit = useCallback(() => setIsEditing(true), []);
	const cancelEdit = useCallback(() => setIsEditing(false), []);

	/*
	 * A saved edit, a removal, a pin, a hide - every one of them changes what the thread holds, so
	 * they all land on the same refetch the reply form uses. The editor closes with it: what comes
	 * back is the row it was editing.
	 */
	const onEntryChanged = useCallback(() => {
		setIsEditing(false);
		onPosted();
	}, [onPosted]);

	/*
	 * A link to a reply names the thread it lives in, and that thread is closed until somebody
	 * opens it - so the link opens it. An effect rather than the initial state: the fragment is
	 * read after mount (there is no `location` while this renders on the server), and a cached
	 * page can have these on screen before it is.
	 */
	useEffect(() => {
		if (openRepliesFor !== null && openRepliesFor === entry.id) {
			setShowReplies(true);
		}
	}, [openRepliesFor, entry.id]);

	// Replies are fetched only once opened: most threads are read, not unrolled, and a page of
	// roots would otherwise cost one request per root on arrival.
	const { data, isLoading } = useReplies(
		entityType,
		entityId,
		showReplies ? entry.id : null,
	);

	const replies = data?.entries ?? [];

	// The replies are their own list, so they carry their own counts - one request for all of
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

	// The count belongs to a thread, and only a root starts one - under a reply it would be a
	// second number next to the first, counting something the reader cannot open from there.
	const isRoot = entry.parent_id === null;

	/*
	 * The first reply is already on screen, so the controls only appear once there is a second
	 * one to reach: a thread of exactly one reply has nothing to expand and nothing to collapse.
	 */
	const hasMoreReplies = isRoot && entry.reply_count > 1;

	const anchorId = commentAnchorId(entry);

	return (
		/*
		 * `scroll-mt` keeps a comment reached by its link clear of the sticky header rather than
		 * under it; the ring marks which of a page of comments the link meant.
		 */
		<li
			id={anchorId}
			className={cn(
				'scroll-mt-24 py-5',
				highlightedAnchor === anchorId &&
					'rounded-lg ring-2 ring-accent',
			)}
		>
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
							{formatRelativeDate(entry.created_at, 14, language)}
						</time>

						{/*
						 * The text on screen is not the text that was posted. `edited_at` and not
						 * `updated_at`: the latter moves for a pin or a moderation decision, which
						 * would mark comments whose author never went back to them.
						 */}
						{entry.edited_at && (
							<span
								className="text-xs text-muted"
								title={String(entry.edited_at)}
							>
								{translations['thread.edited']}
							</span>
						)}
					</div>

					{isEditing ? (
						<CommentEdit
							entry={entry}
							isOwn={abilities.isOwn}
							translations={translations}
							onSaved={onEntryChanged}
							onCancel={cancelEdit}
						/>
					) : (
						<CommentBody
							content={entry.content}
							translations={translations}
						/>
					)}

					{/*
					 * The icon is the reply action; the number beside it is how many replies
					 * this thread already holds. Opening them is a separate control below -
					 * one button cannot both answer a comment and unroll it.
					 */}
					<div className="mt-3 flex items-center gap-4 text-sm text-muted">
						{/*
						 * Icon and count as one group, and the button is a flex box: a bare
						 * `svg` inside a button sits on the text baseline, which left it a
						 * couple of pixels below the reaction icon beside it.
						 */}
						<span className="inline-flex items-center gap-1.5">
							<Button
								variant="ghost"
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
							</Button>

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

						<CommentMenu
							entry={entry}
							translations={translations}
							complaintTranslations={complaintTranslations}
							onEdit={startEdit}
							onChanged={onEntryChanged}
						/>
					</div>

					{hasMoreReplies && !showReplies && (
						<Button
							variant="ghost"
							type="button"
							onClick={() => setShowReplies(true)}
							className="mt-2 text-sm text-accent hover:underline"
						>
							{translations['thread.see_replies']}
						</Button>
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
					 * comment's avatar - the content column starts past the avatar (32px) and
					 * the gap (12px), so -28px lands the border on the avatar's center line,
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
											language={language}
											translations={translations}
											ratingTranslations={
												ratingTranslations
											}
											complaintTranslations={
												complaintTranslations
											}
											ratings={replyRatings}
											onRatingChanged={
												onReplyRatingChanged
											}
											onPosted={onPosted}
											openRepliesFor={openRepliesFor}
											highlightedAnchor={
												highlightedAnchor
											}
										/>
									))
								)}
							</ul>

							{/*
							 * Below the replies rather than beside "See replies": after a long
							 * thread the way out should be where the reading stopped, not back
							 * up at the top.
							 */}
							<Button
								variant="ghost"
								type="button"
								onClick={() => setShowReplies(false)}
								className="mt-2 text-sm text-accent hover:underline"
							>
								{translations['thread.collapse_replies']}
							</Button>
						</>
					) : (
						previewReply && (
							<ul className="-ml-7 mt-4 border-l border-line pl-4">
								<CommentEntry
									entry={previewReply}
									entityType={entityType}
									entityId={entityId}
									language={language}
									translations={translations}
									ratingTranslations={ratingTranslations}
									complaintTranslations={
										complaintTranslations
									}
									// The roots request covers the previews too, so this reply's
									// counts arrived with its parent's.
									ratings={ratings}
									onRatingChanged={onRatingChanged}
									onPosted={onPosted}
									openRepliesFor={openRepliesFor}
									highlightedAnchor={highlightedAnchor}
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
 * one. Nothing here knows what it is attached to beyond `entityType` / `entityId`, so any host that
 * takes comments renders the same section - articles being the only one.
 *
 * Client-rendered against the public endpoint rather than fetched with the host page: those pages
 * are served from a data cache, and a comment approved in the meantime would not appear until that
 * window passed.
 */
export function CommentThread({
	entityType,
	entityId,
	language,
	translations,
	ratingTranslations,
	complaintTranslations,
}: {
	entityType: CommentEntityType;
	entityId: number;
	/** The reader's language, for the posted-at date - see `formatRelativeDate`. */
	language: Language;
	translations: CommentTranslations;
	ratingTranslations: RatingTranslations;
	complaintTranslations: ComplaintTranslations;
}) {
	const queryClient = useQueryClient();

	/*
	 * The comment a link led here for. Read after mount rather than during render - there is no
	 * `location` on the server - and cleared once it has been reached, so paging further does not
	 * scroll the reader back to it.
	 */
	const [anchor, setAnchor] = useState<CommentAnchorType | null>(null);
	const [highlightedAnchor, setHighlightedAnchor] = useState<string | null>(
		null,
	);
	const [anchorAttempt, setAnchorAttempt] = useState(0);

	/*
	 * On arrival, and again whenever the fragment changes: a link to a comment on the page the
	 * reader is already on is a hash change, which navigates nothing and would otherwise leave
	 * the effect below with the anchor it resolved on load.
	 */
	useEffect(() => {
		const readAnchor = () => {
			setAnchor(parseCommentAnchor(window.location.hash));
			setAnchorAttempt(0);
		};

		readAnchor();

		window.addEventListener('hashchange', readAnchor);

		return () => window.removeEventListener('hashchange', readAnchor);
	}, []);

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
	 * Walking the thread until the linked comment is on screen. It may sit past the page that has
	 * been loaded, and a reply sits inside a collapsed thread that `openRepliesFor` unrolls once
	 * its parent arrives - so each attempt loads what it can and looks again shortly after. The
	 * retry is what covers the replies: they arrive through their own query, which this effect
	 * has no other way to hear about.
	 *
	 * It gives up after `ANCHOR_MAX_ATTEMPTS`, because a link can name a comment that has since
	 * been removed, and a fragment is not worth searching for forever.
	 */
	useEffect(() => {
		if (!anchor) {
			return;
		}

		const anchorId = commentAnchorId({
			id: anchor.id,
			parent_id: anchor.parentId,
		});

		const element = document.getElementById(anchorId);

		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });

			setHighlightedAnchor(anchorId);
			setAnchor(null);

			return;
		}

		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}

		if (anchorAttempt >= ANCHOR_MAX_ATTEMPTS) {
			setAnchor(null);

			return;
		}

		const timer = setTimeout(
			() => setAnchorAttempt((attempt) => attempt + 1),
			ANCHOR_RETRY_MS,
		);

		return () => clearTimeout(timer);
	}, [anchor, anchorAttempt, hasNextPage, isFetchingNextPage, fetchNextPage]);

	/*
	 * A posted comment is public straight away unless the backend is holding comments for
	 * moderation (`comment.autoApprove`), so this refetch is usually what puts it on screen -
	 * and when it is not, it still catches the case that matters: a parent whose `reply_count`
	 * moved because a moderator approved something while this page was open.
	 */
	const onPosted = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: ['comment', entityType, entityId],
		});
	}, [queryClient, entityType, entityId]);

	const entries = data?.pages.flatMap((page) => page.entries) ?? [];

	/*
	 * The first reply under each root, which the backend resolves alongside the page so a thread
	 * can show one without being unrolled - and without a request per root to find it.
	 */
	const firstReplies = Object.assign(
		{},
		...(data?.pages.map((page) => page.first_replies ?? {}) ?? []),
	) as Record<number, CommentModel>;

	/*
	 * One request for everything on screen, previews included, re-keyed as more is paged in -
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
							language={language}
							previewReply={firstReplies[entry.id]}
							translations={translations}
							ratingTranslations={ratingTranslations}
							complaintTranslations={complaintTranslations}
							ratings={ratings}
							onRatingChanged={onRatingChanged}
							onPosted={onPosted}
							openRepliesFor={anchor?.parentId ?? null}
							highlightedAnchor={highlightedAnchor}
						/>
					))}
				</ul>
			)}

			{hasNextPage && (
				<Button
					type="button"
					variant="outline"
					onClick={() => void fetchNextPage()}
					disabled={isFetchingNextPage}
					className="mt-4 text-muted"
				>
					{isFetchingNextPage
						? translations['thread.loading']
						: translations['thread.load_more']}
				</Button>
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
