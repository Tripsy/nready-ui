import type { QueryClient } from '@tanstack/react-query';
import { replaceVars } from '@/helpers/string.helper';
import type { EntriesSelectionType } from '@/types/action.type';
import type {
	WindowConfig,
	WindowEntryType,
	WindowType,
} from '@/types/window.type';

export const WINDOW_CACHE_LABEL = 'window-entry';

/**
 * Drops the reloaded copy of the given entries held by every open window on them.
 *
 * Invalidating only the window that wrote is not enough: the cache key carries the window
 * uid, which is `<dataSource>-<action>-<id>`, so a view and a form on the same row cache it
 * under separate keys and the untouched ones keep serving their pre-write copy for the whole
 * `staleTime`. Matching on the uid prefix keeps an unrelated data source that happens to
 * share the id out of it.
 *
 * Only queries with an open window are active, so the refetch cost is bounded by how many
 * windows are stacked on that row — in practice one or two.
 */
export function invalidateWindowEntries(
	queryClient: QueryClient,
	dataSource: string,
	entryIds: readonly number[],
) {
	if (entryIds.length === 0) {
		return Promise.resolve();
	}

	const ids = new Set(entryIds);

	return queryClient.invalidateQueries({
		predicate: (query) =>
			query.queryKey[0] === WINDOW_CACHE_LABEL &&
			typeof query.queryKey[2] === 'number' &&
			ids.has(query.queryKey[2]) &&
			typeof query.queryKey[1] === 'string' &&
			query.queryKey[1].startsWith(`${dataSource}-`),
	});
}

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
