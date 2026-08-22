import { useCallback, useRef, useState } from 'react';
import {
	type CommentTranslations,
	commentAnchorId,
} from '@/components/comment/comment.definition';
import {
	COMPLAINT_COMMENT_REASONS,
	type ComplaintTranslations,
} from '@/components/complaint/complaint.definition';
import { ComplaintReportDialog } from '@/components/complaint/complaint-report.component';
import { Icons } from '@/components/icon.component';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { logger } from '@/helpers/logger.helper';
import { copyToClipboard } from '@/helpers/ui.helper';
import { ComplaintEntityTypeEnum } from '@/models/complaint.model';
import { useToast } from '@/providers/toast.provider';

const MENU_ITEM_CLASS =
	'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground';

/**
 * The per-comment menu: the link to this comment, and the way to report it.
 *
 * Both are secondary to reading the thread, which is why they live behind one control rather than
 * as two more icons in a row that already carries the reply and the reactions.
 */
export function CommentMenu({
	entry,
	translations,
	complaintTranslations,
}: {
	entry: { id: number; parent_id: number | null };
	translations: CommentTranslations;
	complaintTranslations: ComplaintTranslations;
}) {
	const { showToast } = useToast();

	const [isOpen, setIsOpen] = useState(false);
	const [isReportOpen, setIsReportOpen] = useState(false);

	const closeReport = useCallback(() => setIsReportOpen(false), []);

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
					 * the reader arrow-key roving and typeahead, and two items do not earn it.
					 * Tab reaches both, and the popover closes on Escape and on an outside
					 * press by itself.
					 */}
					<button
						type="button"
						onClick={copyLink}
						className={MENU_ITEM_CLASS}
					>
						<Icons.CopyLink className="h-4 w-4" />
						{translations['thread.copy_link']}
					</button>

					<button
						type="button"
						onClick={openReport}
						className={MENU_ITEM_CLASS}
					>
						<Icons.Action.Flag className="h-4 w-4" />
						{translations['thread.report']}
					</button>

					{/*
					 * The fallback's copy source. Rendered rather than created on demand so it
					 * sits inside the popover's focus scope, and `aria-hidden` with no tab stop
					 * so it is not a third item in a menu of two.
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
			 * Outside the popover: it is dismissed the moment the dialog opens, and a dialog
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
		</>
	);
}
