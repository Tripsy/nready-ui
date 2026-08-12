'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CmrSessionDataTableFiltersType } from '@/app/(dashboard)/dashboard/cmr-session/cmr-session.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { type CmrStatus, CmrStatusEnum } from '@/models/cmr.model';
import { type UserModel, UserRoleEnum } from '@/models/user.model';
import {
	type WorkSessionStatus,
	WorkSessionStatusEnum,
} from '@/models/work-session.model';
import { useAuth } from '@/providers/auth.provider';

const cmrStatuses = toOptionsFromEnum(CmrStatusEnum, {
	formatter: formatEnumLabel,
});

const workSessionStatuses = toOptionsFromEnum(WorkSessionStatusEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCmrSession = (): JSX.Element => {
	const { auth } = useAuth();

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cmr-session'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CmrSessionDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<CmrSessionDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const [searchUser, setSearchUser] = useState(filters.user?.value ?? '');

	const onResetUser = useCallback(() => {
		setSearchUser('');
	}, []);

	const searchCmrId = useSearchFilter({
		initialValue: filters.cmr_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValues({ cmr_id: value }),
	});

	const searchWorkSessionId = useSearchFilter({
		initialValue: filters.work_session_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValues({ work_session_id: value }),
	});

	const resetCallbacks = useMemo(
		() => [onResetUser, searchCmrId.onReset, searchWorkSessionId.onReset],
		[onResetUser, searchCmrId.onReset, searchWorkSessionId.onReset],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<CmrSessionDataTableFiltersType>
				labelText="CMR ID"
				fieldName="cmr_id"
				search={searchCmrId}
			/>

			<FormFiltersSelect<CmrSessionDataTableFiltersType>
				labelText="CMR Status"
				fieldName="cmr_status"
				fieldValue={filters.cmr_status.value}
				options={cmrStatuses}
				onChange={(value) =>
					setFilterValues({ cmr_status: value as CmrStatus })
				}
			/>

			<FormFiltersSearch<CmrSessionDataTableFiltersType>
				labelText="Work Session ID"
				fieldName="work_session_id"
				search={searchWorkSessionId}
			/>

			<FormFiltersSelect<CmrSessionDataTableFiltersType>
				labelText="Work Session Status"
				fieldName="work_session_status"
				fieldValue={filters.work_session_status.value}
				options={workSessionStatuses}
				onChange={(value) =>
					setFilterValues({
						work_session_status: value as WorkSessionStatus,
					})
				}
			/>

			{(!auth || auth?.role !== UserRoleEnum.DRIVER) && (
				<FormFiltersAutoComplete<
					CmrSessionDataTableFiltersType,
					UserModel
				>
					labelText="User"
					fieldName="user"
					fieldNameId="user_id"
					fieldValue={searchUser}
					className="pl-8"
					icons={{
						left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
					}}
					setFilterValues={setFilterValues}
					setSearch={setSearchUser}
					dataSourceKey="user"
					getOptionLabel={(m) => m.name}
					getOptionKey={(m) => m.id}
				/>
			)}

			<FormFiltersReset dataSource="cmr-session" />
		</div>
	);
};
