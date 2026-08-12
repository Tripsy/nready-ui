'use client';

import { Spinner, Table } from '@heroui/react';
import type { Selection, SortDescriptor } from '@heroui/react/rac';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	type DataTablePageChangeType,
	DataTablePaginator,
} from '@/app/(dashboard)/_components/data-table-paginator.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import { LoadingComponent } from '@/components/status.component';
import { Checkbox } from '@/components/ui/checkbox';
import { getDataSourceConfig } from '@/config/data-source.config';
import { toUTCISOString } from '@/helpers/date.helper';
import { assertDefined } from '@/helpers/types.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useAuth } from '@/providers/auth.provider';
import type { QueryFiltersType } from '@/types/api.type';
import {
	type DataSourceConfigType,
	DataSourceSectionEnum,
	type DataTableFiltersType,
} from '@/types/data-source.type';

const ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

function findFunctionFilter(filters: DataTableFiltersType): QueryFiltersType {
	return Object.entries(filters).reduce((acc, [key, filter]) => {
		const { value } = filter;

		// Skip empty values
		if (value === null || value === undefined || value === '') {
			return acc;
		}

		// Handle date filters
		if (/_at_start$/.test(key)) {
			acc[key] = toUTCISOString(value as string);
		} else if (/_at_end$/.test(key)) {
			acc[key] = toUTCISOString(value as string, true);
		} else {
			// Convert key 'global' to 'term' for search
			const newKey = key === 'global' ? 'term' : key;
			acc[newKey] = String(value);
		}

		return acc;
	}, {} as QueryFiltersType);
}

export default function DataTableList(props: { dataKey: string }) {
	const { dataKey } = props;
	const { dataSource, selectionMode, dataTableStore } = useDataTable();
	const { auth } = useAuth();

	const tableState = useStore(dataTableStore, (s) => s.tableState);
	const selectedEntries = useStore(dataTableStore, (s) => s.selectedEntries);
	const updateTableState = useStore(
		dataTableStore,
		(s) => s.updateTableState,
	);
	const setSelectedEntries = useStore(
		dataTableStore,
		(s) => s.setSelectedEntries,
	);
	const clearSelectedEntries = useStore(
		dataTableStore,
		(s) => s.clearSelectedEntries,
	);

	const translationsKeys = [
		'dashboard.text.no_entries',
		'dashboard.text.label_data_table',
		'dashboard.text.label_select_row',
		'dashboard.text.label_select_all_rows',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const [dataTable, setDataTable] = useState<
		// biome-ignore lint/suspicious/noExplicitAny: It's fine
		DataSourceConfigType<any>['dataTable'] | null
	>(null);

	useEffect(() => {
		getDataSourceConfig(
			DataSourceSectionEnum.DASHBOARD,
			dataSource,
			'dataTable',
		).then((config) =>
			setDataTable(
				assertDefined(
					config,
					`dataTable config not defined for ${dataSource}`,
				),
			),
		);
	}, [dataSource]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset to first page when filters change
	useEffect(() => {
		clearSelectedEntries();

		updateTableState({
			first: 0,
		});
	}, [clearSelectedEntries, updateTableState, tableState.filters]);

	const queryKey = useMemo(
		() => [
			'dataTable',
			dataSource,
			tableState.first,
			tableState.rows,
			tableState.sortField,
			tableState.sortOrder,
			tableState.filters,
		],
		[
			dataSource,
			tableState.first,
			tableState.rows,
			tableState.sortField,
			tableState.sortOrder,
			tableState.filters,
		],
	);

	const { data, isFetching } = useQuery({
		queryKey,
		/*
		 * The data-source config is loaded asynchronously and is not part of the query
		 * key, so an ungated query would fire once with no `find` to call, fail, and then
		 * sit in its error state forever — the key never changes to trigger a refetch.
		 */
		enabled: dataTable !== null,
		queryFn: async () => {
			const response = await dataTable?.find({
				order_by: tableState.sortField,
				direction: tableState.sortOrder === 1 ? 'ASC' : 'DESC',
				limit: tableState.rows,
				page:
					tableState.rows > 0
						? Math.floor(tableState.first / tableState.rows) + 1
						: 1,
				filter: findFunctionFilter(tableState.filters),
			});

			if (!response) {
				throw new Error(`Could not retrieve ${dataSource} data`);
			}

			return response;
		},
		placeholderData: keepPreviousData,
	});

	const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
	const totalRecords = data?.pagination?.total ?? 0;

	/*
	 * Both `single` and `multiple` tables select rows; only a `null` selectionMode opts a
	 * table out of selection entirely. `multiple` additionally gets a checkbox column and
	 * `toggle` selection behaviour so several rows can be picked at once — `single` selects
	 * (and replaces) one row on click, with no checkbox column, matching react-aria's own
	 * `single`/`multiple` distinction.
	 */
	const isSelectable = selectionMode !== null;
	const isMultiSelectable = selectionMode === 'multiple';

	const onPageChange = useCallback(
		({ first, rows }: DataTablePageChangeType) => {
			clearSelectedEntries();

			updateTableState({ first, rows });
		},
		[clearSelectedEntries, updateTableState],
	);

	// The store keeps the backend's own sort shape (field + 1/-1); react-aria speaks
	// column + ascending/descending, so the two are mapped at this boundary.
	const sortDescriptor = useMemo<SortDescriptor | undefined>(
		() =>
			tableState.sortField && tableState.sortOrder
				? {
						column: tableState.sortField,
						direction:
							tableState.sortOrder === 1
								? 'ascending'
								: 'descending',
					}
				: undefined,
		[tableState.sortField, tableState.sortOrder],
	);

	const onSortChange = useCallback(
		(descriptor: SortDescriptor) => {
			clearSelectedEntries();

			updateTableState({
				first: 0,
				sortField: String(descriptor.column),
				sortOrder: descriptor.direction === 'ascending' ? 1 : -1,
			});
		},
		[clearSelectedEntries, updateTableState],
	);

	/**
	 * Row identity. `dataKey` names a field every entry carries (`id` across the whole
	 * dashboard), but it arrives as a plain string while `Entry` is the union of every
	 * model — so the lookup is widened here, once, rather than at each call site.
	 */
	const getRowKey = useCallback(
		(entry: object): string =>
			String((entry as Record<string, unknown>)[dataKey]),
		[dataKey],
	);

	const selectedKeys = useMemo<Selection>(
		() => new Set(selectedEntries.map(getRowKey)),
		[selectedEntries, getRowKey],
	);

	const onSelectionChange = useCallback(
		(selection: Selection) => {
			/*
			 * Selection is page-scoped — it is cleared on every page, sort and filter
			 * change — so the header checkbox's `all` means exactly the rows currently
			 * rendered, and the store keeps whole entries because the action buttons
			 * operate on entries, not ids.
			 */
			setSelectedEntries(
				selection === 'all'
					? entries
					: entries.filter((entry) =>
							selection.has(getRowKey(entry)),
						),
			);
		},
		[entries, getRowKey, setSelectedEntries],
	);

	if (isTranslationLoading || !dataTable) {
		return <LoadingComponent />;
	}

	const columns = dataTable.columns;

	return (
		<div className="data-table">
			<div className="relative">
				<Table variant="secondary">
					<Table.ResizableContainer>
						<Table.Content
							aria-label={
								translations['dashboard.text.label_data_table']
							}
							selectionMode={
								isMultiSelectable
									? 'multiple'
									: isSelectable
										? 'single'
										: 'none'
							}
							selectionBehavior={
								isMultiSelectable ? 'toggle' : 'replace'
							}
							selectedKeys={selectedKeys}
							onSelectionChange={onSelectionChange}
							sortDescriptor={sortDescriptor}
							onSortChange={onSortChange}
						>
							<Table.Header>
								{isMultiSelectable && (
									<Table.Column
										id="selection"
										width={48}
										minWidth={48}
									>
										<Checkbox
											slot="selection"
											aria-label={
												translations[
													'dashboard.text.label_select_all_rows'
												]
											}
										/>
									</Table.Column>
								)}

								{columns.map((column, index) => (
									<Table.Column
										key={column.field}
										id={column.field}
										// react-aria requires exactly one row header per row; the
										// first data column is the closest thing to a row label.
										isRowHeader={index === 0}
										allowsSorting={column.sortable ?? false}
										defaultWidth={column.defaultWidth}
										minWidth={column.minWidth}
										maxWidth={column.maxWidth}
									>
										{({ allowsSorting, sortDirection }) => (
											<>
												{allowsSorting ? (
													<Table.SortableColumnHeader
														sortDirection={
															sortDirection
														}
													>
														{column.header}
													</Table.SortableColumnHeader>
												) : (
													column.header
												)}
												{/* The handle is drawn straddling the column's right
												    edge, so on the last column it would stick out past
												    the table and give the container a permanent
												    horizontal scrollbar. Nothing follows it to trade
												    width with either. */}
												{index < columns.length - 1 && (
													<Table.ColumnResizer />
												)}
											</>
										)}
									</Table.Column>
								))}
							</Table.Header>

							<Table.Body
								items={entries}
								dependencies={[columns, auth, isSelectable]}
								renderEmptyState={() => (
									<div className="py-6 text-center text-muted">
										{
											translations[
												'dashboard.text.no_entries'
											]
										}
									</div>
								)}
							>
								{(entry) => (
									<Table.Row id={getRowKey(entry)}>
										{isMultiSelectable && (
											<Table.Cell>
												<Checkbox
													slot="selection"
													aria-label={
														translations[
															'dashboard.text.label_select_row'
														]
													}
												/>
											</Table.Cell>
										)}

										{columns.map((column) => (
											<Table.Cell key={column.field}>
												{column.body
													? column.body(
															entry,
															column,
															auth,
														)
													: entry[column.field]}
											</Table.Cell>
										))}
									</Table.Row>
								)}
							</Table.Body>
						</Table.Content>
					</Table.ResizableContainer>
				</Table>

				{/* `isFetching`, not `isLoading`: `keepPreviousData` keeps the previous page
				    on screen while the next one loads, which is precisely when the overlay
				    has something to cover. */}
				{isFetching && (
					<div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-surface/60 backdrop-blur-[1px]">
						<Spinner />
					</div>
				)}
			</div>

			<DataTablePaginator
				first={tableState.first}
				rows={tableState.rows}
				totalRecords={totalRecords}
				rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
				onPageChange={onPageChange}
			/>
		</div>
	);
}
