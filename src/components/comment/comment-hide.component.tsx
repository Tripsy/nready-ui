/*
 * No `'use client'`: `comment-menu.component.tsx` - itself below the `comment-thread` boundary
 * and directive-free for the same reason - is what mounts this. Carrying the directive would
 * make Next's TS plugin treat the file as a client *entry* and reject the non-serializable
 * props below (TS71007); `onClose` and `onHidden` are plain callbacks, not server actions.
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
	COMMENT_HIDE_STATUSES,
	type CommentTranslations,
	commentHideLabelKey,
} from '@/components/comment/comment.definition';
import { FormComponentTextarea } from '@/components/form/form-element.component';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/helpers/css.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { type CommentStatus, CommentStatusEnum } from '@/models/comment.model';
import { useToast } from '@/providers/toast.provider';
import { requestModerateCommentStatus } from '@/services/comment.service';

/** The backend's own cap on `moderation_reason`; a longer one comes back as a validation error. */
const MODERATION_REASON_MAX = 255;

/**
 * Taking a comment off the page from the page itself, with the reason recorded against it.
 *
 * Two outcomes rather than one, because they are read differently afterwards: `rejected` is a
 * decision about this comment, `spam` is a judgement about who wrote it - and the dashboard's
 * queues are filtered on exactly that difference. Neither is offered as a "delete": the row stays,
 * which is what makes the decision reversible from the dashboard.
 *
 * There is no way back to `approved` here. A public thread returns approved comments and nothing
 * else, so a moderator standing in it cannot see the queue they would be approving from.
 */
export function CommentHideDialog({
	entry,
	translations,
	isOpen,
	onClose,
	onHidden,
}: {
	entry: { id: number };
	translations: CommentTranslations;
	isOpen: boolean;
	onClose: () => void;
	onHidden: () => void;
}) {
	const { showToast } = useToast();

	const [status, setStatus] = useState<CommentStatus>(
		CommentStatusEnum.REJECTED,
	);
	const [reason, setReason] = useState('');

	const elementIds = useElementIds(['reason'] as const);

	const trimmedReason = reason.trim();
	const isReasonTooLong = trimmedReason.length > MODERATION_REASON_MAX;

	const { mutate: hide, isPending } = useMutation({
		mutationFn: () =>
			requestModerateCommentStatus(
				entry.id,
				status,
				trimmedReason || undefined,
			),
		onSuccess: () => {
			showToast({
				severity: 'success',
				summary: translations['thread.hide_success'],
			});

			onHidden();
			onClose();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['thread.hide_failed'],
				// Distinguishes a move the comment's current state does not allow - somebody else
				// having moderated it in the meantime - from a permission this reader lacks.
				detail: getErrorMessage(error),
			}),
	});

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={translations['thread.hide_title']}
			size="lg"
		>
			<div className="space-y-4 pb-4">
				<p className="text-sm text-muted">
					{translations['thread.hide_intro']}
				</p>

				{/*
				 * Two mutually exclusive outcomes, so a radio group - segmented buttons would
				 * read as two separate actions, each of which submits.
				 */}
				<fieldset className="flex flex-wrap gap-2">
					<legend className="sr-only">
						{translations['thread.hide_title']}
					</legend>

					{COMMENT_HIDE_STATUSES.map((option) => (
						<label
							key={option}
							className={cn(
								'flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
								status === option
									? 'border-accent text-accent'
									: 'border-line text-muted hover:text-foreground',
							)}
						>
							<input
								type="radio"
								name="hide_status"
								value={option}
								checked={status === option}
								disabled={isPending}
								onChange={() => setStatus(option)}
								className="sr-only"
							/>

							{translations[commentHideLabelKey(option)]}
						</label>
					))}
				</fieldset>

				<div>
					<FormComponentTextarea<{ reason: string }>
						labelText={translations['thread.hide_reason']}
						id={elementIds.reason}
						fieldName="reason"
						fieldValue={reason}
						rows={3}
						disabled={isPending}
						onChange={(event) => setReason(event.target.value)}
						error={
							isReasonTooLong
								? [translations['thread.hide_reason_long']]
								: undefined
						}
					/>

					{/*
					 * The reason is the state the comment is in *now*, not an entry in a log -
					 * the next decision overwrites it. Worth saying, since "reason" reads like
					 * something that accumulates.
					 */}
					<p className="text-xs text-muted">
						{translations['thread.hide_reason_note']}
					</p>
				</div>

				<Button
					type="button"
					variant="warning"
					onClick={() => hide()}
					disabled={isPending || isReasonTooLong}
				>
					{translations['thread.hide_submit']}
				</Button>
			</div>
		</Modal>
	);
}
