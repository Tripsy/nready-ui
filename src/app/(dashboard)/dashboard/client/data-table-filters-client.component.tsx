'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { ClientDataTableFiltersType } from '@/app/(dashboard)/dashboard/client/client.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type ClientStatus,
	ClientStatusEnum,
	type ClientType,
	ClientTypeEnum,
} from '@/models/client.model';

const statuses = toOptionsFromEnum(ClientStatusEnum, {
	formatter: formatEnumLabel,
});

const clientTypes = toOptionsFromEnum(ClientTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersClient = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'client'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ClientDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<ClientDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValue('global', value),
	});

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset],
		[searchGlobal.onReset],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<ClientDataTableFiltersType>
				labelText="ID / Name / CUI / CNP"
				search={searchGlobal}
			/>

			<FormFiltersSelect<ClientDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as ClientStatus)
				}
			/>

			<FormFiltersSelect<ClientDataTableFiltersType>
				labelText="Type"
				fieldName="client_type"
				fieldValue={filters.client_type.value}
				options={clientTypes}
				onChange={(value) =>
					setFilterValue('client_type', value as ClientType)
				}
			/>

			<FormFiltersDateRange<ClientDataTableFiltersType>
				labelText="Create Date"
				start={{
					fieldName: 'create_at_start',
					fieldValue: filters.create_at_start.value,
					onSelect: (value) =>
						setFilterValue('create_at_start', value),
				}}
				end={{
					fieldName: 'create_at_end',
					fieldValue: filters.create_at_end.value,
					onSelect: (value) => setFilterValue('create_at_end', value),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="client"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="client" />
		</div>
	);
};
