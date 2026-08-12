import { useCallback } from 'react';

type FilterMap = Record<string, { value: unknown }>;

type FilterUpdates<T extends FilterMap> = Partial<{
	[K in keyof T]: T[K]['value'];
}>;

interface FilterStore {
	getState: () => { tableState: { filters: unknown } };
}

export function useSetFilterValues<T extends FilterMap>(
	dataTableStore: FilterStore,
	updateTableState: (partial: Record<string, unknown>) => void,
) {
	const setFilterValue = useCallback(
		<K extends keyof T>(key: K, value: T[K]['value']) => {
			const currentFilters = dataTableStore.getState().tableState
				.filters as T;
			updateTableState({
				filters: {
					...currentFilters,
					[key]: {
						...currentFilters[key],
						value,
					},
				},
			});
		},
		[dataTableStore, updateTableState],
	);

	const setFilterValues = useCallback(
		(updates: FilterUpdates<T>) => {
			const currentFilters = dataTableStore.getState().tableState
				.filters as T;
			const updatedFilters = { ...currentFilters };

			for (const key of Object.keys(updates) as Array<keyof T>) {
				updatedFilters[key] = {
					...currentFilters[key],
					value: updates[key] as T[typeof key]['value'],
				};
			}

			updateTableState({ filters: updatedFilters });
		},
		[dataTableStore, updateTableState],
	);

	return { setFilterValue, setFilterValues };
}
