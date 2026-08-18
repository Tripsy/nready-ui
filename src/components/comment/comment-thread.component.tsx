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
import { showAvatar } from '@/components/ui/avatar.component';
import { getResponseData } from '@/helpers/api.helper';
import { formatRelativeDate } from '@/helpers/date.helper';
import type { CommentEntityType, CommentModel } from '@/models/comment.model';
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
	translations,
	onPosted,
}: {
	entry: CommentModel;
	entityType: CommentEntityType;
	entityId: number;
	translations: CommentTranslations;
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

	const closeReplyForm = useCallback(() => setShowReplyForm(false), []);

	const onReplyPosted = useCallback(() => {
		setShowReplyForm(false);
		onPosted();
	}, [onPosted]);

	const author = commentAuthor(entry, translations);

	// The count belongs to a thread, and only a root starts one — under a reply it would be a
	// second number next to the first, counting something the reader cannot open from there.
	const isRoot = entry.parent_id === null;
	const hasReplies = isRoot && entry.reply_count > 0;

	return (
		<li className="border-t border-line py-5 first:border-t-0">
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
					<div className="mt-3 flex items-center gap-1.5 text-sm text-muted">
						<button
							type="button"
							onClick={() => setShowReplyForm((open) => !open)}
							aria-expanded={showReplyForm}
							aria-label={translations['thread.reply']}
							title={translations['thread.reply']}
							className="transition-colors hover:text-foreground"
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
					</div>

					{hasReplies && !showReplies && (
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

					{showReplies && (
						<>
							<ul className="mt-4 border-l border-line pl-4">
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
}: {
	entityType: CommentEntityType;
	entityId: number;
	translations: CommentTranslations;
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
							translations={translations}
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
