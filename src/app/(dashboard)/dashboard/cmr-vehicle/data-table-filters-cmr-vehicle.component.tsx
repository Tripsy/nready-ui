'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CmrVehicleDataTableFiltersType } from '@/app/(dashboard)/dashboard/cmr-vehicle/cmr-vehicle.definition';
import { Icons } from '@/components/icon.component';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { displayVehicleLabel, type VehicleModel } from '@/models/vehicle.model';

export const DataTableFiltersCmrVehicle = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cmr-vehicle'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CmrVehicleDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<CmrVehicleDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const [searchVehicle, setSearchVehicle] = useState(
		filters.vehicle?.value ?? '',
	);

	const onResetVehicle = useCallback(() => {
		setSearchVehicle('');
	}, []);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	const searchCmrId = useSearchFilter({
		initialValue: filters.cmr_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValues({ cmr_id: value }),
	});

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, searchCmrId.onReset, onResetVehicle],
		[searchGlobal.onReset, searchCmrId.onReset, onResetVehicle],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<CmrVehicleDataTableFiltersType>
				labelText="ID / Vin / Plate / Notes"
				search={searchGlobal}
			/>

			<FormFiltersSearch<CmrVehicleDataTableFiltersType>
				labelText="CMR ID"
				fieldName="cmr_id"
				search={searchCmrId}
			/>

			<FormFiltersAutoComplete<
				CmrVehicleDataTableFiltersType,
				VehicleModel
			>
				labelText="Vehicle"
				fieldName="vehicle"
				fieldNameId="vehicle_id"
				fieldValue={searchVehicle}
				className="pl-8"
				icons={{
					left: <Icons.Vehicle className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchVehicle}
				dataSourceKey="vehicle"
				getOptionLabel={(m) => displayVehicleLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersShowDeleted
				dataSource="vehicle"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => {
					setFilterValues({ is_deleted: value });
				}}
			/>

			<FormFiltersReset dataSource="cmr-vehicle" />
		</div>
	);
};
