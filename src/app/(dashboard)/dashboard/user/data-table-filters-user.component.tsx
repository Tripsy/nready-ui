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
import type { UserDataTableFiltersType } from '@/app/(dashboard)/dashboard/user/user.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type UserRole,
	UserRoleEnum,
	type UserStatus,
	UserStatusEnum,
} from '@/models/user.model';

const statuses = toOptionsFromEnum(UserStatusEnum, {
	formatter: formatEnumLabel,
});

const roles = toOptionsFromEnum(UserRoleEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersUser = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'user'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as UserDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<UserDataTableFiltersType>(
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
			<FormFiltersSearch<UserDataTableFiltersType>
				labelText="ID / Email / Name"
				search={searchGlobal}
			/>

			<FormFiltersSelect<UserDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as UserStatus)
				}
			/>

			<FormFiltersSelect<UserDataTableFiltersType>
				labelText="Role"
				fieldName="role"
				fieldValue={filters.role.value}
				options={roles}
				onChange={(value) => setFilterValue('role', value as UserRole)}
			/>

			<FormFiltersDateRange<UserDataTableFiltersType>
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
				dataSource="user"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="user" />
		</div>
	);
};
