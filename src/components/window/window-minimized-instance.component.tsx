'use client';

import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import {
	displayWindowTitle,
	resolveWindowEntries,
} from '@/helpers/window.helper';
import { useModalStore } from '@/stores/window.store';
import type { EntriesSelectionType } from '@/types/action.type';
import type { WindowConfig, WindowType } from '@/types/window.type';

export function WindowMinimizedInstance({
	current,
}: {
	current: WindowConfig;
}) {
	const { close, focus } = useModalStore();

	const handleClose = () => close(current.uid);
	const handleRestore = () => focus(current.uid);

	const windowProps = current.props;
	const definition = current.definition;

	const type = definition.windowType as WindowType<EntriesSelectionType>;

	const { entry, entries } = resolveWindowEntries(current, type);

	const modalTitle =
		windowProps?.title ||
		displayWindowTitle({
			entriesSelection: definition.entriesSelection,
			entriesCount: entries.length || 0,
			entryLabel:
				definition.entriesSelection === 'single' &&
				definition.displayEntryLabel &&
				entry
					? definition.displayEntryLabel(entry)
					: undefined,
			windowTitle: definition.windowTitle,
		});

	return (
		<div className="flex items-center gap-x-2 border shadow-xl px-2 py-1 rounded bg-background/95 hover:bg-accent-soft hover:text-accent-soft-foreground">
			<button
				type="button"
				className="flex-1 cursor-row-resize text-sm text-ellipsis overflow-hidden max-w-36 whitespace-nowrap"
				onClick={handleRestore}
				title={modalTitle}
			>
				{modalTitle}
			</button>
			<div>
				<Button
					variant="ghost"
					className="rounded-full p-1"
					hover="error"
					size="xs"
					onClick={handleClose}
					aria-label="Close modal"
				>
					<Icons.Close size={12} />
				</Button>
			</div>
		</div>
	);
}
