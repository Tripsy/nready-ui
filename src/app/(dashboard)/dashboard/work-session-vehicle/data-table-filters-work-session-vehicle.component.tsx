'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersReset,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { WorkSessionVehicleDataTableFiltersType } from '@/app/(dashboard)/dashboard/work-session-vehicle/work-session-vehicle.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type CompanyVehicleModel,
	displayCompanyVehicleLabel,
} from '@/models/company-vehicle.model';
import {
	type WorkSessionStatus,
	WorkSessionStatusEnum,
} from '@/models/work-session.model';
import {
	type WorkSessionVehicleStatus,
	WorkSessionVehicleStatusEnum,
} from '@/models/work-session-vehicle.model';

const workSessionStatuses = toOptionsFromEnum(WorkSessionStatusEnum, {
	formatter: formatEnumLabel,
});
const statuses = toOptionsFromEnum(WorkSessionVehicleStatusEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersWorkSessionVehicle = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'work-session-vehicle'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as WorkSessionVehicleDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<WorkSessionVehicleDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const [searchCompanyVehicle, setSearchCompanyVehicle] = useState(
		filters.company_vehicle?.value ?? '',
	);

	const onResetCompanyVehicle = useCallback(() => {
		setSearchCompanyVehicle('');
	}, []);

	const resetCallbacks = useMemo(
		() => [onResetCompanyVehicle],
		[onResetCompanyVehicle],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersAutoComplete<
				WorkSessionVehicleDataTableFiltersType,
				CompanyVehicleModel
			>
				labelText="Vehicle"
				fieldName="company_vehicle"
				fieldNameId="company_vehicle_id"
				fieldValue={searchCompanyVehicle}
				className="pl-8"
				icons={{
					left: (
						<Icons.CompanyVehicle className="opacity-40 h-4.5 w-4.5" />
					),
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchCompanyVehicle}
				dataSourceKey="company-vehicle"
				getOptionLabel={(m) => displayCompanyVehicleLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersSelect<WorkSessionVehicleDataTableFiltersType>
				labelText="Session Status"
				fieldName="status"
				fieldValue={filters.work_session_status.value}
				options={workSessionStatuses}
				onChange={(value) =>
					setFilterValues({
						work_session_status: value as WorkSessionStatus,
					})
				}
			/>

			<FormFiltersSelect<WorkSessionVehicleDataTableFiltersType>
				labelText="Vehicle Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({
						status: value as WorkSessionVehicleStatus,
					})
				}
			/>

			<FormFiltersReset dataSource="work-session-vehicle" />
		</div>
	);
};
