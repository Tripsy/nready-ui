import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import {
	type CommentTranslations,
	commentAnchorId,
	resolveCommentAbilities,
} from '@/components/comment/comment.definition';
import { CommentHideDialog } from '@/components/comment/comment-hide.component';
import {
	COMPLAINT_COMMENT_REASONS,
	type ComplaintTranslations,
} from '@/components/complaint/complaint.definition';
import { ComplaintReportDialog } from '@/components/complaint/complaint-report.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { getErrorMessage } from '@/helpers/error.helper';
import { logger } from '@/helpers/logger.helper';
import { copyToClipboard } from '@/helpers/ui.helper';
import { useConfirmationDialog } from '@/hooks/use-confirmation-dialog';
import type { CommentModel } from '@/models/comment.model';
import { ComplaintEntityTypeEnum } from '@/models/complaint.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import {
	requestDeleteComment,
	requestModerateComment,
	requestModerateDeleteComment,
} from '@/services/comment.service';

/**
 * `justify-start` is not decoration: `Button`'s base centers its content, which for a menu is a
 * column of labels each starting at a different x. A list is read down its left edge.
 */
const MENU_ITEM_CLASS =
	'flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground';

/**
 * The per-comment menu: the link to this comment, the way to report it, and — for the reader who
 * wrote it or a member of staff — the ways to change it.
 *
 * All of it is secondary to reading the thread, which is why it lives behind one control rather
 * than as a row of icons beside the reply and the reactions. What each reader is offered comes
 * from `resolveCommentAbilities`; the backend gates every one of these endpoints itself, so the
 * menu decides what to show and nothing more.
 */
export function CommentMenu({
	entry,
	translations,
	complaintTranslations,
	onEdit,
	onChanged,
}: {
	entry: CommentModel;
	translations: CommentTranslations;
	complaintTranslations: ComplaintTranslations;
	/** Puts the row into the inline editor, which the thread owns — this menu only asks for it. */
	onEdit: () => void;
	/** The comment is no longer what the thread has: refetch it. */
	onChanged: () => void;
}) {
	const { auth } = useAuth();
	const { showToast } = useToast();

	const [isOpen, setIsOpen] = useState(false);
	const [isReportOpen, setIsReportOpen] = useState(false);
	const [isHideOpen, setIsHideOpen] = useState(false);

	const closeReport = useCallback(() => setIsReportOpen(false), []);
	const closeHide = useCallback(() => setIsHideOpen(false), []);

	const { openDialog, dialogProps } = useConfirmationDialog();

	const abilities = resolveCommentAbilities(auth, entry);

	// Only ever read by the `execCommand` fallback above; on a secure origin nothing touches it.
	const fallbackFieldRef = useRef<HTMLTextAreaElement>(null);

	/*
	 * The address of the page the thread is rendered on plus this comment's fragment — the
	 * comments have no page of their own, and the host's path is the only thing that leads back
	 * here. `search` is kept: a listing filter or a campaign parameter is part of where the
	 * reader is, and dropping it would hand somebody else a different page.
	 */
	const copyLink = useCallback(async () => {
		const { origin, pathname, search } = window.location;
		const url = `${origin}${pathname}${search}#${commentAnchorId(entry)}`;

		try {
			// Before the menu closes: the fallback copies from a field inside it, and a
			// dismissed popover takes that field with it.
			await copyToClipboard(url, fallbackFieldRef.current);

			showToast({
				severity: 'success',
				summary: translations['thread.copy_link_success'],
				detail: url,
			});
		} catch (error) {
			// Denied permission or a non-secure origin — neither is something the reader can
			// act on, so the address is shown for them to copy by hand.
			logger.warn('Could not copy the comment link', error, {
				commentId: entry.id,
			});

			showToast({
				severity: 'error',
				summary: translations['thread.copy_link_failed'],
				detail: url,
			});
		} finally {
			setIsOpen(false);
		}
	}, [entry, showToast, translations]);

	const openReport = useCallback(() => {
		setIsOpen(false);
		setIsReportOpen(true);
	}, []);

	/**
	 * The author's withdrawal and the moderator's removal are the same button and two endpoints:
	 * the public one narrows to the caller's own row and needs no permission, the dashboard one
	 * needs `comment.delete`. Both are hard deletes that take the thread below with them, which is
	 * what the confirmation says.
	 */
	const { mutate: remove } = useMutation({
		mutationFn: () =>
			abilities.isOwn
				? requestDeleteComment(entry.id)
				: requestModerateDeleteComment(entry.id),
		onSuccess: () => {
			showToast({
				severity: 'success',
				summary: translations['thread.delete_success'],
			});

			onChanged();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['thread.delete_failed'],
				detail: getErrorMessage(error),
			}),
	});

	const { mutate: togglePin } = useMutation({
		mutationFn: () =>
			requestModerateComment(entry.id, { is_pinned: !entry.is_pinned }),
		onSuccess: () => {
			showToast({
				severity: 'success',
				summary: translations['thread.pin_success'],
			});

			onChanged();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['thread.pin_failed'],
				detail: getErrorMessage(error),
			}),
	});

	const confirmDelete = useCallback(() => {
		setIsOpen(false);

		openDialog({
			title: translations['thread.delete_title'],
			description: translations['thread.delete_confirm'],
			onConfirm: () => remove(),
			buttonConfirm: { hover: 'warning' },
		});
	}, [openDialog, remove, translations]);

	return (
		<>
			<Popover isOpen={isOpen} onOpenChange={setIsOpen}>
				<Popover.Trigger
					className="flex cursor-pointer items-center transition-colors hover:text-foreground"
					aria-label={translations['thread.menu']}
					title={translations['thread.menu']}
				>
					<Icons.MoreVertical className="h-4 w-4" />
				</Popover.Trigger>

				<PopoverContent
					placement="bottom end"
					className="w-56 border border-line bg-surface p-1 shadow-lg"
				>
					{/*
					 * A plain list of buttons rather than the ARIA menu pattern: that one owes
					 * the reader arrow-key roving and typeahead, and a handful of items do not
					 * earn it. Tab reaches them all, and the popover closes on Escape and on an
					 * outside press by itself.
					 */}
					<Button
						type="button"
						onClick={copyLink}
						variant="ghost"
						className={MENU_ITEM_CLASS}
					>
						<Icons.CopyLink className="h-4 w-4" />
						{translations['thread.copy_link']}
					</Button>

					<Button
						type="button"
						onClick={openReport}
						variant="ghost"
						className={MENU_ITEM_CLASS}
					>
						<Icons.Action.Flag className="h-4 w-4" />
						{translations['thread.report']}
					</Button>

					{abilities.canEdit && (
						<Button
							type="button"
							onClick={() => {
								setIsOpen(false);
								onEdit();
							}}
							variant="ghost"
							className={MENU_ITEM_CLASS}
						>
							<Icons.Action.Update className="h-4 w-4" />
							{translations['thread.edit']}
						</Button>
					)}

					{abilities.canModerate && (
						<>
							<Button
								type="button"
								onClick={() => {
									setIsOpen(false);
									togglePin();
								}}
								variant="ghost"
								className={MENU_ITEM_CLASS}
							>
								{entry.is_pinned ? (
									<Icons.Action.Unpin className="h-4 w-4" />
								) : (
									<Icons.Action.Pin className="h-4 w-4" />
								)}
								{
									translations[
										entry.is_pinned
											? 'thread.unpin'
											: 'thread.pin'
									]
								}
							</Button>

							<Button
								type="button"
								onClick={() => {
									setIsOpen(false);
									setIsHideOpen(true);
								}}
								variant="ghost"
								className={MENU_ITEM_CLASS}
							>
								<Icons.Obscured className="h-4 w-4" />
								{translations['thread.hide']}
							</Button>
						</>
					)}

					{abilities.canDelete && (
						<Button
							type="button"
							onClick={confirmDelete}
							variant="ghost"
							className={MENU_ITEM_CLASS}
						>
							<Icons.Action.Delete className="h-4 w-4" />
							{translations['thread.delete']}
						</Button>
					)}

					{/*
					 * The fallback's copy source. Rendered rather than created on demand so it
					 * sits inside the popover's focus scope, and `aria-hidden` with no tab stop
					 * so it is not another item in the list.
					 */}
					<textarea
						ref={fallbackFieldRef}
						readOnly
						tabIndex={-1}
						aria-hidden="true"
						className="pointer-events-none absolute h-px w-px opacity-0"
					/>
				</PopoverContent>
			</Popover>

			{/*
			 * Outside the popover: it is dismissed the moment any of these opens, and a dialog
			 * mounted inside it would go with it.
			 */}
			<ComplaintReportDialog
				entityType={ComplaintEntityTypeEnum.COMMENT}
				entityId={entry.id}
				reasons={COMPLAINT_COMMENT_REASONS}
				translations={complaintTranslations}
				isOpen={isReportOpen}
				onClose={closeReport}
			/>

			{abilities.canModerate && (
				<CommentHideDialog
					entry={entry}
					translations={translations}
					isOpen={isHideOpen}
					onClose={closeHide}
					onHidden={onChanged}
				/>
			)}

			<ConfirmationDialog {...dialogProps} />
		</>
	);
}
