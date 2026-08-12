import { useEffect, useRef } from 'react';
import { addFilterResetListener } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import { useRefreshDataTable } from '@/hooks/use-refresh-data-table.hook';
import type { DataSourceKey } from '@/types/data-source.key';
import type {
	DataTableFiltersType,
	DataTableStateType,
} from '@/types/data-source.type';

type UseDataTableFilterResetOptions = {
	dataSource: DataSourceKey;
	defaultFilters: DataTableFiltersType;
	updateTableState: (state: Partial<DataTableStateType>) => void;
	onReset?: (() => void)[];
};

export function useDataTableFilterReset({
	dataSource,
	defaultFilters,
	updateTableState,
	onReset = [],
}: UseDataTableFilterResetOptions) {
	const refreshDataTable = useRefreshDataTable();

	// Intentionally not synced — default filters are fixed at mount time
	const defaultFiltersRef = useRef(defaultFilters);

	const onResetRef = useRef(onReset);

	useEffect(() => {
		onResetRef.current = onReset;
	}, [onReset]);

	useEffect(() => {
		return addFilterResetListener(async ({ source }) => {
			if (source !== dataSource) return;

			updateTableState({ filters: defaultFiltersRef.current });

			await refreshDataTable(dataSource);

			for (const reset of onResetRef.current) {
				reset();
			}
		});
	}, [dataSource, updateTableState, refreshDataTable]);
}
