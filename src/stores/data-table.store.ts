import type { Draft } from 'immer';
import { create, type StateCreator } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { DataSourceKey } from '@/types/data-source.key';
import type {
	DataSourceSection,
	DataTableFiltersType,
	DataTableStateType,
} from '@/types/data-source.type';

// ============================================================================
// TABLE SLICE
// ============================================================================

export interface DataTableSlice {
	tableState: DataTableStateType;
	updateTableState: (newState: Partial<DataTableStateType>) => void;
}

export const createDataTableSlice =
	(
		initialState: DataTableStateType,
	): StateCreator<
		DataTableStore,
		[['zustand/immer', never]],
		[],
		DataTableSlice
	> =>
	(set) => ({
		tableState: structuredClone(initialState),

		updateTableState: (newState) =>
			set((state: Draft<DataTableSlice>) => {
				state.tableState = {
					...state.tableState,
					...newState,
					filters:
						(newState.filters as Draft<DataTableFiltersType>) ||
						state.tableState.filters,
				};
			}),
	});

// ============================================================================
// SELECTION SLICE
// ============================================================================

export interface DataTableSelectionSlice<Model> {
	selectedEntries: Model[];
	setSelectedEntries: (entries: Model[]) => void;
	clearSelectedEntries: () => void;
}

export const createDataTableSelectionSlice =
	<Model>(): StateCreator<
		DataTableStore<Model>,
		[['zustand/immer', never]],
		[],
		DataTableSelectionSlice<Model>
	> =>
	(set) => ({
		selectedEntries: [],

		setSelectedEntries: (entries) =>
			set((state: Draft<DataTableSelectionSlice<Model>>) => {
				state.selectedEntries = entries as Draft<Model>[];
			}),

		clearSelectedEntries: () =>
			set((state: Draft<DataTableSelectionSlice<Model>>) => {
				state.selectedEntries = [];
			}),
	});

// ============================================================================
// STORE
// ============================================================================

// biome-ignore lint/suspicious/noExplicitAny: It's fine
export type DataTableStore<Model = any> = DataTableSlice &
	DataTableSelectionSlice<Model> & {
		isLoading: boolean;
		setLoading: (loading: boolean) => void;
	};

export const createDataTableStore = <K extends DataSourceKey, Model>(
	section: DataSourceSection,
	dataSource: K,
	initialState: DataTableStateType,
) =>
	create<DataTableStore<Model>>()(
		devtools(
			persist(
				immer((set, get, store) => ({
					...createDataTableSlice(initialState)(set, get, store),
					...createDataTableSelectionSlice<Model>()(set, get, store),

					isLoading: false,
					setLoading: (loading: boolean) => {
						set((state) => {
							state.isLoading = loading;
						});
					},
				})),
				{
					name: `datatable-store-${String(section)}-${String(dataSource)}`,
					// Bump on breaking changes to `DataTableStateType`/filters shape to drop stale
					// persisted state. v2: `term` stopped accepting `value` as a sort field, and a
					// rehydrated `sortField` the backend rejects fails the whole list request.
					// v3: the product listing swapped `is_sellable` for `sale_status` and gained
					// `brand`/`brand_id`; a rehydrated filter set missing a key the component
					// reads throws on `filters.<key>.value` before the table renders.
					version: 3,
					partialize: (state) => ({
						tableState: state.tableState,
						selectedEntries: state.selectedEntries,
					}),
				},
			),
		),
	);

export type DataTableStoreType<K extends DataSourceKey, Model> = ReturnType<
	typeof createDataTableStore<K, Model>
>;
