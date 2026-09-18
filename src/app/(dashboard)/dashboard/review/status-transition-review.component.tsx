'use client';

import { useCallback, useMemo } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { DisplayStatus } from '@/helpers/display.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { requestUpdateStatus } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	REVIEW_STATUS_TRANSITIONS,
	type ReviewModel,
	type ReviewStatus,
} from '@/models/review.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

/**
 * The moderation decision, as the set of moves allowed from where the review currently sits.
 *
 * A review has no single next state - `pending` can go to approved, rejected or spam - so the
 * status badge cannot act on one click. It opens this instead, and the moves are drawn from the
 * same transition map the backend enforces, so a button is never offered for a move that would
 * come back 409.
 *
 * Approving is what publishes the review: it is also what lets readers comment on, rate or report
 * it, since the backend refuses all three against a review that is not approved.
 */
export function StatusTransitionReview({
	entries,
}: {
	entries: ReviewModel[];
}) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'review.error.cannot_update_status',
		'review.action.statusTransition.success',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry
				? getStatusTransitions(entry.status, REVIEW_STATUS_TRANSITIONS)
				: [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: ReviewModel, status: ReviewStatus) => {
			try {
				await requestUpdateStatus('review', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[
						'review.action.statusTransition.success'
					],
				});

				dispatchFilterReset('review');
			} catch (error) {
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: (error as Error).message,
				});
			} finally {
				close();
			}
		},
		[showToast, translations, close],
	);

	if (!entry) {
		return <ErrorComponent />;
	}

	if (isTranslationLoading) {
		return <LoadingComponent />;
	}

	if (!statusTransitions.length) {
		return (
			<ErrorComponent
				description={translations['review.error.cannot_update_status']}
			/>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">Change review status to:</p>
			<div className="flex flex-wrap gap-4 items-center">
				{statusTransitions.map((status) => {
					return (
						<button
							key={status}
							type="button"
							className="cursor-pointer"
							aria-label={`Set status to ${status}`}
							onClick={() => handleStatusUpdate(entry, status)}
						>
							<DisplayStatus
								status={status}
								dataSource="review"
							/>
						</button>
					);
				})}
			</div>
		</div>
	);
}
