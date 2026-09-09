'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Icons } from '@/components/icon.component';
import type { ReviewTranslations } from '@/components/review/review.definition';
import { ReviewForm } from '@/components/review/review-form.component';
import { ReviewStars } from '@/components/review/review-stars.component';
import { ReviewSummary } from '@/components/review/review-summary.component';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import Routes from '@/config/routes.setup';
import { getResponseData } from '@/helpers/api.helper';
import { formatDate } from '@/helpers/date.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { useConfirmationDialog } from '@/hooks/use-confirmation-dialog';
import {
	type ReviewOwnModel,
	type ReviewPublicListType,
	type ReviewPublicModel,
	ReviewStatusEnum,
	type ReviewSummaryType,
} from '@/models/review.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import {
	requestDeleteOwnReview,
	requestProductReviewSummary,
	requestProductReviews,
} from '@/services/review.service';

const PAGE_SIZE = 5;

/**
 * The reviews of one product: the score, the approved reviews, and the reader's own.
 *
 * Two reads rather than one on purpose. The **summary** describes the whole product and is the
 * same for every visitor, so it is cached the way any shared read is; the **list** carries `own`,
 * which is nobody else's business and must not be cached anywhere shared - hence `staleTime: 0` on
 * it. Paging in more reviews therefore never moves the score beside them.
 */
export function ReviewSection({
	productId,
	variantId,
	translations,
}: {
	productId: number;
	/**
	 * The variant the reader actually chose - `?variant=` on the product page - or null. A page
	 * opened without one has a variant selected for display, which is not the same as the buyer
	 * saying which they bought, so it is not passed here.
	 */
	variantId: number | null;
	translations: ReviewTranslations;
}) {
	const { auth } = useAuth();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const { openDialog, dialogProps } = useConfirmationDialog();

	const isMember = Boolean(auth?.id);

	// One page at a time, appended rather than replaced: a "load more" list keeps what the reader
	// has already read on screen.
	const [page, setPage] = useState(1);
	const [loaded, setLoaded] = useState<ReviewPublicModel[]>([]);

	const summaryKey = useMemo(
		() => ['review-summary', productId],
		[productId],
	);

	const listKey = useMemo(
		() => ['review-list', productId, page],
		[productId, page],
	);

	const summaryQuery = useQuery({
		queryKey: summaryKey,
		queryFn: async () => {
			const response = await requestProductReviewSummary(productId);

			return getResponseData<ReviewSummaryType>(response) ?? null;
		},
	});

	const listQuery = useQuery({
		queryKey: listKey,
		queryFn: async () => {
			const response = await requestProductReviews(productId, {
				page: page,
				limit: PAGE_SIZE,
			});

			const data = getResponseData<ReviewPublicListType>(response);

			// Appended here rather than in a `useEffect`: the pages arrive in order and each one
			// is added once, when it resolves.
			setLoaded((current) =>
				page === 1
					? (data?.entries ?? [])
					: [
							...current,
							...(data?.entries ?? []).filter(
								(entry) =>
									!current.some(
										(known) => known.id === entry.id,
									),
							),
						],
			);

			return data ?? null;
		},
		// The answer carries `own`, which is this reader's alone - and it changes through the form
		// below, so a cached one would offer to write a review they have just withdrawn.
		staleTime: 0,
	});

	const own: ReviewOwnModel | null = listQuery.data?.own ?? null;
	const total = listQuery.data?.pagination.total ?? 0;
	const hasMore = loaded.length < total;

	/**
	 * Both reads, after a write. The summary because an approval may have changed the score, the
	 * list because `own` certainly changed - and it is reset to the first page, since the entries
	 * already on screen came from a listing that no longer matches.
	 */
	const refresh = useCallback(() => {
		setPage(1);
		setLoaded([]);
		queryClient.invalidateQueries({
			queryKey: ['review-summary', productId],
		});
		queryClient.invalidateQueries({ queryKey: ['review-list', productId] });
	}, [productId, queryClient]);

	const onWritten = useCallback(() => {
		showToast({
			severity: 'success',
			summary: own
				? translations['form.success_edit']
				: translations['form.success'],
		});

		refresh();
	}, [own, refresh, showToast, translations]);

	const { mutate: withdraw, isPending: withdrawing } = useMutation({
		mutationFn: () => requestDeleteOwnReview(productId),
		onSuccess: () => {
			showToast({
				severity: 'success',
				summary: translations['form.withdraw_success'],
			});

			refresh();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['form.withdraw_failed'],
				detail: getErrorMessage(error),
			}),
	});

	/*
	 * The app's own dialog rather than `window.confirm`: a native one blocks the page's event
	 * loop, cannot be styled or translated, and reads as a browser warning rather than as part of
	 * the site. `ConfirmationDialog` is what the comment menu asks with, for the same reasons.
	 */
	const onWithdraw = useCallback(() => {
		openDialog({
			title: translations['form.withdraw'],
			description: translations['form.withdraw_confirm'],
			onConfirm: () => withdraw(),
			buttonConfirm: { hover: 'warning' },
		});
	}, [openDialog, translations, withdraw]);

	if (summaryQuery.isError || listQuery.isError) {
		return (
			<section className="mt-12 border-t border-line pt-8">
				<h2 className="text-xl font-semibold">
					{translations['section.heading']}
				</h2>

				<ErrorComponent
					description={translations['section.unavailable']}
				/>
			</section>
		);
	}

	return (
		<section className="mt-12 border-t border-line pt-8">
			<h2 className="text-xl font-semibold">
				{translations['section.heading']}
			</h2>

			<div className="mt-6">
				{summaryQuery.isLoading ? (
					<LoadingComponent />
				) : summaryQuery.data && summaryQuery.data.total > 0 ? (
					<ReviewSummary
						summary={summaryQuery.data}
						translations={translations}
					/>
				) : (
					<p className="text-muted">
						{translations['section.empty']}
					</p>
				)}
			</div>

			{loaded.length > 0 && (
				<ul className="mt-8 space-y-6">
					{loaded.map((entry) => (
						<ReviewEntry
							key={entry.id}
							entry={entry}
							translations={translations}
						/>
					))}
				</ul>
			)}

			{hasMore && (
				<button
					type="button"
					onClick={() => setPage((current) => current + 1)}
					disabled={listQuery.isFetching}
					className="mt-6 text-sm text-accent hover:underline disabled:opacity-60"
				>
					{listQuery.isFetching
						? translations['section.loading']
						: translations['section.load_more']}
				</button>
			)}

			<div className="mt-10 border-t border-line pt-6">
				<h3 className="text-lg font-semibold">
					{own
						? translations['form.heading_edit']
						: translations['form.heading']}
				</h3>

				{!isMember ? (
					<div className="mt-3 space-y-3">
						<p className="text-sm text-muted">
							{translations['form.guest']}
						</p>

						{/* The reader lands back on the product they were reading, which is the
						    only place the review makes sense. */}
						<Link
							href={`${Routes.get('login')}?from=${encodeURIComponent(pathname)}`}
							className="text-sm text-accent hover:underline"
						>
							{translations['form.sign_in']}
						</Link>
					</div>
				) : listQuery.isPending ? (
					/*
					 * The form is not offered before the list has answered. `own` arrives with
					 * that read, and `useActionState` fixes its initial state on the first
					 * render - a form mounted before then would open blank for a reader who
					 * already has a review, and its submit would try to write a second one.
					 */
					<LoadingComponent />
				) : (
					<div className="mt-4">
						{/*
						 * What a moderator has decided, said plainly. A pending review is not in
						 * the list above and not in the score, which is what somebody who has just
						 * written one is looking for.
						 */}
						{own?.status === ReviewStatusEnum.PENDING && (
							<p className="mb-4 text-sm text-muted">
								{translations['section.pending_note']}
							</p>
						)}

						{/*
						 * Once a moderator has acted, the review is theirs to stand behind rather
						 * than the author's to change: the backend answers 403 to both a revision
						 * and a withdrawal outside `pending`, so neither the form nor the withdraw
						 * button is offered - the reader is told where their review stands and
						 * shown what they wrote.
						 */}
						{own && own.status !== ReviewStatusEnum.PENDING ? (
							<div className="space-y-3">
								<p className="text-sm text-muted">
									{own.status === ReviewStatusEnum.APPROVED
										? translations['section.approved_note']
										: translations['section.rejected_note']}
								</p>

								<blockquote className="border-l-2 border-line pl-3 text-sm">
									{own.content}
								</blockquote>
							</div>
						) : (
							<ReviewForm
								/*
								 * Keyed on the answer the form is seeded from, not on a submit
								 * counter. `useActionState` reads its initial state once, so the
								 * form has to remount whenever that answer changes - and it
								 * changes at three different moments: a first review (null to an
								 * id), a revision (`updated_at` moves), and a withdrawal (back
								 * to null). A counter bumped on submit remounts too early, while
								 * the list is still refetching, and re-seeds the form from the
								 * row that was just replaced.
								 */
								key={`${own?.id ?? 'new'}-${String(own?.updated_at ?? '')}`}
								productId={productId}
								variantId={variantId}
								own={own}
								translations={translations}
								onWritten={onWritten}
								onWithdraw={onWithdraw}
								withdrawing={withdrawing}
							/>
						)}
					</div>
				)}
			</div>

			<ConfirmationDialog {...dialogProps} />
		</section>
	);
}

/** One review as a reader sees it: who wrote it, when, its score and its text. */
function ReviewEntry({
	entry,
	translations,
}: {
	entry: ReviewPublicModel;
	translations: ReviewTranslations;
}) {
	return (
		<li className="border-b border-line pb-6 last:border-0 last:pb-0">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<ReviewStars value={entry.rating_avg} size="sm" />

				<span className="text-sm font-medium">
					{entry.user?.name ?? `#${entry.user_id}`}
				</span>

				{/* A badge the dashboard stands behind - it is not derived from anything yet. */}
				{entry.is_verified && (
					<span className="inline-flex items-center gap-1 text-xs text-success">
						<Icons.Status.Verified className="h-3.5 w-3.5" />
						{translations['section.verified']}
					</span>
				)}

				{entry.is_pinned && (
					<span className="text-xs text-muted">
						{translations['section.pinned']}
					</span>
				)}

				<span className="text-xs text-muted">
					{formatDate(entry.created_at, 'default')}
				</span>
			</div>

			<p className="mt-2 whitespace-pre-line text-sm">{entry.content}</p>
		</li>
	);
}
