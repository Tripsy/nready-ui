'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { OrderDataTableFiltersType } from '@/app/(dashboard)/dashboard/order/order.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	type OrderStatus,
	OrderStatusEnum,
	type OrderType,
	OrderTypeEnum,
} from '@/models/order.model';

const statuses = toOptionsFromEnum(OrderStatusEnum, {
	formatter: formatEnumLabel,
});

const types = toOptionsFromEnum(OrderTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersOrder = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'order'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as OrderDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<OrderDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	/*
	 * The backend reads a whole reference (`ORD-1183`) as both halves of the document number, an
	 * all-digit term as either the id or the number, and anything else as the series code - so one
	 * box covers every way an order is cited.
	 */
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	const [searchClient, setSearchClient] = useState(
		filters.client?.value ?? '',
	);

	const onResetClient = useCallback(() => {
		setSearchClient('');
	}, []);

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, onResetClient],
		[searchGlobal.onReset, onResetClient],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<OrderDataTableFiltersType>
				labelText="ID / Reference"
				search={searchGlobal}
			/>

			<FormFiltersAutoComplete<OrderDataTableFiltersType, ClientModel>
				labelText="Client"
				fieldName="client"
				fieldNameId="client_id"
				fieldValue={searchClient}
				className="pl-8"
				icons={{
					left: <Icons.Client className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchClient}
				dataSourceKey="client"
				getOptionLabel={(entry) => displayClientLabel(entry)}
				getOptionKey={(entry) => entry.id}
			/>

			<FormFiltersSelect<OrderDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as OrderStatus })
				}
			/>

			<FormFiltersSelect<OrderDataTableFiltersType>
				labelText="Type"
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValues({ type: value as OrderType })
				}
			/>

			<FormFiltersDateRange<OrderDataTableFiltersType>
				labelText="Issued"
				start={{
					fieldName: 'issued_at_start',
					fieldValue: filters.issued_at_start.value,
					onSelect: (value) =>
						setFilterValues({ issued_at_start: value }),
				}}
				end={{
					fieldName: 'issued_at_end',
					fieldValue: filters.issued_at_end.value,
					onSelect: (value) =>
						setFilterValues({ issued_at_end: value }),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="order"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="order" />
		</div>
	);
};
