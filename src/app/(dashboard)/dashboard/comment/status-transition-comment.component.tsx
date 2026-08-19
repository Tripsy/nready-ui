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
	COMMENT_STATUS_TRANSITIONS,
	type CommentModel,
	type CommentStatus,
} from '@/models/comment.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

/**
 * The moderation decision, as the set of moves allowed from where the comment currently sits.
 *
 * A comment has no single next state — `pending` can go to approved, rejected or spam — so the
 * status badge cannot act on one click the way `complaint`'s does. It opens this instead, and the
 * moves are drawn from the same transition map the backend enforces, so a button is never offered
 * for a move that would come back 409.
 */
export function StatusTransitionComment({
	entries,
}: {
	entries: CommentModel[];
}) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'comment.error.cannot_update_status',
		'comment.action.statusTransition.success',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry
				? getStatusTransitions(entry.status, COMMENT_STATUS_TRANSITIONS)
				: [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: CommentModel, status: CommentStatus) => {
			try {
				await requestUpdateStatus('comment', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[
						'comment.action.statusTransition.success'
					],
				});

				dispatchFilterReset('comment');
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
				description={translations['comment.error.cannot_update_status']}
			/>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">Change comment status to:</p>
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
								dataSource="comment"
							/>
						</button>
					);
				})}
			</div>
		</div>
	);
}
