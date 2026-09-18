'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { WarehouseDataTableFiltersType } from '@/app/(dashboard)/dashboard/warehouse/warehouse.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type WarehouseStatus,
	WarehouseStatusEnum,
} from '@/models/warehouse.model';

const statuses = toOptionsFromEnum(WarehouseStatusEnum, {
	formatter: formatEnumLabel,
});

/**
 * `is_default` is a boolean on the wire, so it cannot ride `toOptionsFromEnum`. The empty value
 * the select clears to means "either", which is the filter being absent rather than false.
 */
const defaultOptions = [
	{ label: 'Default only', value: 'true' },
	{ label: 'Not default', value: 'false' },
];

export const DataTableFiltersWarehouse = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'warehouse'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as WarehouseDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<WarehouseDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
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
			<FormFiltersSearch<WarehouseDataTableFiltersType>
				labelText="ID / Code / Name"
				search={searchGlobal}
			/>

			<FormFiltersSelect<WarehouseDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as WarehouseStatus })
				}
			/>

			<FormFiltersSelect<WarehouseDataTableFiltersType>
				labelText="Default"
				fieldName="is_default"
				fieldValue={
					filters.is_default.value === null
						? null
						: String(filters.is_default.value)
				}
				options={defaultOptions}
				onChange={(value) =>
					setFilterValues({
						is_default: value === '' ? null : value === 'true',
					})
				}
			/>

			<FormFiltersShowDeleted
				dataSource="warehouse"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="warehouse" />
		</div>
	);
};
