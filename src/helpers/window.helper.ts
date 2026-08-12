import { replaceVars } from '@/helpers/string.helper';
import type { EntriesSelectionType } from '@/types/action.type';
import type {
	WindowConfig,
	WindowEntryType,
	WindowType,
} from '@/types/window.type';

export const WINDOW_CACHE_LABEL = 'window-entry';

export function displayWindowTitle({
	entriesSelection,
	entriesCount,
	entryLabel,
	windowTitle = 'n/a',
}: {
	entriesSelection: EntriesSelectionType;
	entriesCount: number;
	entryLabel?: string;
	windowTitle?: string;
}) {
	switch (entriesSelection) {
		case 'single': {
			return replaceVars(windowTitle, {
				entry: entryLabel ?? 'n/a',
			});
		}
		case 'multiple':
			return replaceVars(windowTitle, {
				entries: entriesCount.toString(),
			});
		default:
			return windowTitle;
	}
}

export function generateWindowUid<Entry>({
	dataSource,
	action,
	entriesSelection = 'free',
	entries,
}: {
	dataSource: string;
	action: string;
	entriesSelection: EntriesSelectionType;
	entries?: Entry[];
}) {
	if (entriesSelection === 'single') {
		const entry = entries?.[0];

		if (!entry) {
			throw new Error(
				`Entry not defined for window type "${dataSource}-${action}"`,
			);
		}

		// We assume every entry has an `id` property & entries exist
		const entryId = (entry as unknown as { id: number }).id;

		return `${dataSource}-${action}-${entryId}`;
	}

	return `${dataSource}-${action}`;
}

export function resolveWindowEntries(
	current: WindowConfig,
	type: WindowType<EntriesSelectionType>,
): { entry: WindowEntryType | undefined; entries: WindowEntryType[] } {
	const data = current.data;
	const { entriesSelection } = current.definition;

	// Check entries are defined for multiple selection
	if (entriesSelection === 'multiple') {
		const entries = data?.entries ?? [];

		if (entries.length === 0) {
			throw new Error(`No entries defined for window type "${type}"`);
		}

		return { entry: undefined, entries };
	}

	// Declare entry for form create
	if (entriesSelection === 'free') {
		if (type === 'form' && current.action === 'create') {
			return { entry: data?.prefillEntry, entries: [] };
		}
	}

	// Declare entry for single selection (eg: form update, view, single action)
	if (entriesSelection === 'single') {
		const entry = data?.entries?.[0];

		if (!entry) {
			throw new Error(`Entry not defined for window type "${type}"`);
		}

		// Check entry id is defined for form update
		if (type === 'form' && current.action === 'update' && !entry.id) {
			throw new Error(`Entry id not defined for form update`);
		}

		return { entry, entries: [] };
	}

	return { entry: undefined, entries: [] };
}
