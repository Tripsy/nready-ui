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
import type { CompanyVehicleDataTableFiltersType } from '@/app/(dashboard)/dashboard/company-vehicle/company-vehicle.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type CompanyVehicleScope,
	CompanyVehicleScopeEnum,
	type CompanyVehicleStatus,
	CompanyVehicleStatusEnum,
} from '@/models/company-vehicle.model';

const statuses = toOptionsFromEnum(CompanyVehicleStatusEnum, {
	formatter: formatEnumLabel,
});

const scopes = toOptionsFromEnum(CompanyVehicleScopeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCompanyVehicle = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'company-vehicle'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CompanyVehicleDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } =
		useSetFilterValues<CompanyVehicleDataTableFiltersType>(
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
			<FormFiltersSearch<CompanyVehicleDataTableFiltersType>
				labelText="ID / Plate / VIN / Notes"
				search={searchGlobal}
			/>

			<FormFiltersSelect<CompanyVehicleDataTableFiltersType>
				labelText="Scope"
				fieldName="scope"
				fieldValue={filters.scope.value}
				options={scopes}
				onChange={(value) =>
					setFilterValue('scope', value as CompanyVehicleScope)
				}
			/>

			<FormFiltersSelect<CompanyVehicleDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as CompanyVehicleStatus)
				}
			/>

			<FormFiltersShowDeleted
				dataSource="company-vehicle"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="company-vehicle" />
		</div>
	);
};
