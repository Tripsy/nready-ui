'use client';

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { LoadingComponent } from '@/components/status.component';
import { getDataSourceConfig } from '@/config/data-source.config';
import { assertDefined } from '@/helpers/types.helper';
import {
	createDataTableStore,
	type DataTableStoreType,
} from '@/stores/data-table.store';
import type { DataSourceKey, DatasourceModels } from '@/types/data-source.key';
import {
	type DataSourceConfigType,
	DataSourceSectionEnum,
	type DataTableSelectionModeType,
	type DataTableStateType,
} from '@/types/data-source.type';

type DataTableContextType<K extends DataSourceKey, Model> = {
	dataSource: K;
	selectionMode: DataTableSelectionModeType;
	dataTableStateDefault: DataTableStateType;
	dataTableStore: DataTableStoreType<K, Model>;
};

const DataTableContext = createContext<
	// biome-ignore lint/suspicious/noExplicitAny: Context is initialized without concrete generics; actual types are provided by the DataTable provider.
	DataTableContextType<any, any> | undefined
>(undefined);

function DataTableProvider<K extends DataSourceKey>({
	dataSource,
	selectionMode,
	children,
}: {
	dataSource: K;
	selectionMode: DataTableSelectionModeType;
	children: ReactNode;
}) {
	type Entry = DatasourceModels[K];

	const [dataTable, setDataTable] = useState<
		DataSourceConfigType<Entry>['dataTable'] | null
	>(null);
	const dataTableStoreRef = useRef<DataTableStoreType<K, Entry> | null>(null);

	useEffect(() => {
		getDataSourceConfig(
			DataSourceSectionEnum.DASHBOARD,
			dataSource,
			'dataTable',
		).then((config) => {
			const dt = assertDefined(
				config,
				`dataTable config not defined for ${dataSource}`,
			);

			dataTableStoreRef.current = createDataTableStore<K, Entry>(
				DataSourceSectionEnum.DASHBOARD,
				dataSource,
				dt.state,
			);

			setDataTable(dt); // triggers re-render, ref is already set
		});
	}, [dataSource]);

	// const selectedEntries = useStore(
	// 	dataTableStore,
	// 	(state) => state.selectedEntries,
	// );

	// const prevSelectedEntriesRef = useRef<Model[]>([]);
	//
	// useDebouncedEffect(
	// 	() => {
	// 		const prev = prevSelectedEntriesRef.current;
	// 		const { onRowSelect, onRowUnselect } = dataTable;
	//
	// 		if (onRowSelect) {
	// 			const added = selectedEntries.filter(
	// 				(e) => !prev.some((p) => p === e),
	// 			);
	// 			added.forEach(onRowSelect);
	// 		}
	//
	// 		if (onRowUnselect) {
	// 			const removed = prev.filter(
	// 				(e) => !selectedEntries.some((s) => s === e),
	// 			);
	// 			removed.forEach(onRowUnselect);
	// 		}
	//
	// 		prevSelectedEntriesRef.current = selectedEntries;
	// 	},
	// 	[dataTable, selectedEntries],
	// 	500,
	// );

	const contextValue = useMemo(
		() => ({
			dataSource,
			selectionMode,
			dataTableStateDefault:
				dataTable?.state ?? ({} as DataTableStateType),
			// biome-ignore lint/style/noNonNullAssertion: It's fine
			dataTableStore: dataTableStoreRef.current!,
		}),
		[dataSource, selectionMode, dataTable?.state],
	);

	if (!dataTable || !dataTableStoreRef.current) {
		return <LoadingComponent />;
	}

	return (
		<DataTableContext.Provider value={contextValue}>
			{children}
		</DataTableContext.Provider>
	);
}

function useDataTable<K extends DataSourceKey>() {
	const context = useContext(DataTableContext);

	if (!context) {
		throw new Error('useDataTable must be used within a DataTableProvider');
	}

	type Entry = DatasourceModels[K];

	return context as DataTableContextType<K, Entry>;
}

export { DataTableProvider, useDataTable };
