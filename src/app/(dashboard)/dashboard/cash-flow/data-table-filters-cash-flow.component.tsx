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
import type { CashFlowDataTableFiltersType } from '@/app/(dashboard)/dashboard/cash-flow/cash-flow.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type CashFlowCategory,
	type CashFlowDirection,
	CashFlowDirectionEnum,
	type CashFlowMethod,
	CashFlowMethodEnum,
	type CashFlowStatus,
	CashFlowStatusEnum,
	GroupedCategories,
} from '@/models/cash-flow.model';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	type CompanyVehicleModel,
	displayCompanyVehicleLabel,
} from '@/models/company-vehicle.model';
import {
	displayUserLabel,
	type UserModel,
	UserRoleEnum,
} from '@/models/user.model';
import { displayVendorLabel, type VendorModel } from '@/models/vendor.model';
import { useAuth } from '@/providers/auth.provider';
import { type Currency, CurrencyEnum } from '@/types/common.type';

const statuses = toOptionsFromEnum(CashFlowStatusEnum, {
	formatter: formatEnumLabel,
});

const directions = toOptionsFromEnum(CashFlowDirectionEnum, {
	formatter: formatEnumLabel,
});

const currencies = toOptionsFromEnum(CurrencyEnum, {
	formatter: formatEnumLabel,
});

const methods = toOptionsFromEnum(CashFlowMethodEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCashFlow = (): JSX.Element => {
	const { auth } = useAuth();

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cash-flow'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CashFlowDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<CashFlowDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) =>
			setFilterValues({
				global: value,
			}),
	});

	const [searchClient, setSearchClient] = useState(
		filters.client?.value ?? '',
	);

	const onResetClient = useCallback(() => {
		setSearchClient('');
	}, []);

	const [searchEmployee, setSearchEmployee] = useState(
		filters.employee?.value ?? '',
	);

	const onResetEmployee = useCallback(() => {
		setSearchEmployee('');
	}, []);

	const [searchVendor, setSearchVendor] = useState(
		filters.vendor?.value ?? '',
	);

	const onResetVendor = useCallback(() => {
		setSearchVendor('');
	}, []);

	const [searchCompanyVehicle, setSearchCompanyVehicle] = useState(
		filters.company_vehicle?.value ?? '',
	);

	const onResetCompanyVehicle = useCallback(() => {
		setSearchCompanyVehicle('');
	}, []);

	const resetCallbacks = useMemo(
		() => [
			searchGlobal.onReset,
			onResetClient,
			onResetEmployee,
			onResetVendor,
			onResetCompanyVehicle,
		],
		[
			searchGlobal.onReset,
			onResetClient,
			onResetEmployee,
			onResetVendor,
			onResetCompanyVehicle,
		],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<CashFlowDataTableFiltersType>
				labelText="ID / Reference / Notes"
				search={searchGlobal}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText="Direction"
				fieldName="direction"
				fieldValue={filters.direction.value}
				options={directions}
				onChange={(value) =>
					setFilterValues({
						direction: value as CashFlowDirection,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText="Category"
				fieldName="category"
				fieldValue={filters.category.value}
				options={GroupedCategories}
				onChange={(value) =>
					setFilterValues({
						category: value as CashFlowCategory,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText="Method"
				fieldName="method"
				fieldValue={filters.method?.value ?? null}
				options={methods}
				onChange={(value) =>
					setFilterValues({
						method: value as CashFlowMethod,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText="Currency"
				fieldName="currency"
				fieldValue={filters.currency.value}
				options={currencies}
				onChange={(value) =>
					setFilterValues({
						currency: value as Currency,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({
						status: value as CashFlowStatus,
					})
				}
			/>

			<FormFiltersDateRange<CashFlowDataTableFiltersType>
				labelText="Create Date"
				start={{
					fieldName: 'create_at_start',
					fieldValue: filters.create_at_start.value,
					onSelect: (value) =>
						setFilterValues({
							create_at_start: value,
						}),
				}}
				end={{
					fieldName: 'create_at_end',
					fieldValue: filters.create_at_end.value,
					onSelect: (value) =>
						setFilterValues({
							create_at_end: value,
						}),
				}}
			/>

			<FormFiltersAutoComplete<CashFlowDataTableFiltersType, ClientModel>
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
				getOptionLabel={(m) => displayClientLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			{(!auth || auth?.role !== UserRoleEnum.DRIVER) && (
				<FormFiltersAutoComplete<
					CashFlowDataTableFiltersType,
					UserModel
				>
					labelText="Employee"
					fieldName="employee"
					fieldNameId="employee_id"
					fieldValue={searchEmployee}
					className="pl-8"
					icons={{
						left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
					}}
					setFilterValues={setFilterValues}
					setSearch={setSearchEmployee}
					dataSourceKey="user"
					getOptionLabel={(m) => displayUserLabel(m)}
					getOptionKey={(m) => m.id}
				/>
			)}

			<FormFiltersAutoComplete<CashFlowDataTableFiltersType, VendorModel>
				labelText="Vendor"
				fieldName="vendor"
				fieldNameId="vendor_id"
				fieldValue={searchVendor}
				className="pl-8"
				icons={{
					left: <Icons.Vendor className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchVendor}
				dataSourceKey="vendor"
				getOptionLabel={(m) => displayVendorLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersAutoComplete<
				CashFlowDataTableFiltersType,
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

			<FormFiltersShowDeleted
				dataSource="cash-flow"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({
						is_deleted: value,
					})
				}
			/>

			<FormFiltersReset dataSource="cash-flow" />
		</div>
	);
};
