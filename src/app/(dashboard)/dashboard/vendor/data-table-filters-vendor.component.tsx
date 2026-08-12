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
import type { VendorDataTableFiltersType } from '@/app/(dashboard)/dashboard/vendor/vendor.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type VendorStatus,
	VendorStatusEnum,
	type VendorType,
	VendorTypeEnum,
} from '@/models/vendor.model';

const statuses = toOptionsFromEnum(VendorStatusEnum, {
	formatter: formatEnumLabel,
});

const types = toOptionsFromEnum(VendorTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersVendor = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'vendor'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as VendorDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<VendorDataTableFiltersType>(
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
			<FormFiltersSearch<VendorDataTableFiltersType>
				labelText="ID / Name"
				search={searchGlobal}
			/>

			<FormFiltersSelect<VendorDataTableFiltersType>
				labelText="Type"
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValues({ type: value as VendorType })
				}
			/>

			<FormFiltersSelect<VendorDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as VendorStatus })
				}
			/>

			<FormFiltersShowDeleted
				dataSource="vendor"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="vendor" />
		</div>
	);
};
