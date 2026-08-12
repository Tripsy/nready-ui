'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { VehicleDataTableFiltersType } from '@/app/(dashboard)/dashboard/vehicle/vehicle.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import type { BrandModel } from '@/models/brand.model';
import {
	type VehicleStatus,
	VehicleStatusEnum,
	type VehicleType,
	VehicleTypeEnum,
} from '@/models/vehicle.model';

const statuses = toOptionsFromEnum(VehicleStatusEnum, {
	formatter: formatEnumLabel,
});

const vehicleTypes = toOptionsFromEnum(VehicleTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersVehicle = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'vehicle'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as VehicleDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<VehicleDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	const [searchBrand, setSearchBrand] = useState(filters.brand?.value ?? '');

	const onResetBrand = useCallback(() => {
		setSearchBrand('');
	}, []);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, onResetBrand],
		[searchGlobal.onReset, onResetBrand],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<VehicleDataTableFiltersType>
				labelText="ID / Model"
				search={searchGlobal}
			/>

			<FormFiltersAutoComplete<VehicleDataTableFiltersType, BrandModel>
				labelText="Brand"
				fieldName="brand"
				fieldNameId="brand_id"
				fieldValue={searchBrand}
				className="pl-8"
				icons={{
					left: <Icons.Brand className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchBrand}
				dataSourceKey="brand"
				getOptionLabel={(m) => m.name}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersSelect<VehicleDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as VehicleStatus })
				}
			/>

			<FormFiltersSelect<VehicleDataTableFiltersType>
				labelText="Type"
				fieldName="vehicle_type"
				fieldValue={filters.vehicle_type.value}
				options={vehicleTypes}
				onChange={(value) =>
					setFilterValues({ vehicle_type: value as VehicleType })
				}
			/>

			<FormFiltersShowDeleted
				dataSource="vehicle"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="vehicle" />
		</div>
	);
};
