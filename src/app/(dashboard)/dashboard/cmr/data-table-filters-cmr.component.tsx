'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CmrDataTableFiltersType } from '@/app/(dashboard)/dashboard/cmr/cmr.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	type CmrStatus,
	CmrStatusEnum,
	type CmrTransportType,
	CmrTransportTypeEnum,
} from '@/models/cmr.model';
import {
	displayUserLabel,
	type UserModel,
	UserRoleEnum,
} from '@/models/user.model';
import { useAuth } from '@/providers/auth.provider';

const statuses = toOptionsFromEnum(CmrStatusEnum, {
	formatter: formatEnumLabel,
});

const transportTypes = toOptionsFromEnum(CmrTransportTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCmr = (): JSX.Element => {
	const { auth } = useAuth();

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cmr'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CmrDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<CmrDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	const [searchClient, setSearchClient] = useState(
		filters.client?.value ?? '',
	);

	const onResetClient = useCallback(() => {
		setSearchClient('');
	}, []);

	const [searchUser, setSearchUser] = useState(filters.user?.value ?? '');

	const onResetUser = useCallback(() => {
		setSearchUser('');
	}, []);

	const resetCallbacks = useMemo(
		() => [onResetClient, onResetUser],
		[onResetClient, onResetUser],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersAutoComplete<CmrDataTableFiltersType, ClientModel>
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
				<FormFiltersAutoComplete<CmrDataTableFiltersType, UserModel>
					labelText="Assigned Driver"
					fieldName="user_id"
					fieldNameId="user_id"
					fieldValue={searchUser}
					className="pl-8"
					icons={{
						left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
					}}
					setFilterValues={setFilterValues}
					setSearch={setSearchUser}
					dataSourceKey="user"
					getOptionLabel={(m) => displayUserLabel(m)}
					getOptionKey={(m) => m.id}
				/>
			)}

			<FormFiltersSelect<CmrDataTableFiltersType>
				labelText="Type"
				fieldName="transport_type"
				fieldValue={filters.transport_type.value}
				options={transportTypes}
				onChange={(value) =>
					setFilterValues({
						transport_type: value as CmrTransportType,
					})
				}
			/>

			<FormFiltersSelect<CmrDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as CmrStatus })
				}
			/>

			<FormFiltersDateRange<CmrDataTableFiltersType>
				labelText="Pick Scheduled Date"
				start={{
					fieldName: 'pick_scheduled_at_start',
					fieldValue: filters.pick_scheduled_at_start.value,
					onSelect: (value) =>
						setFilterValues({ pick_scheduled_at_start: value }),
				}}
				end={{
					fieldName: 'pick_scheduled_at_end',
					fieldValue: filters.pick_scheduled_at_end.value,
					onSelect: (value) =>
						setFilterValues({ pick_scheduled_at_end: value }),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="cmr"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="cmr" />
		</div>
	);
};
