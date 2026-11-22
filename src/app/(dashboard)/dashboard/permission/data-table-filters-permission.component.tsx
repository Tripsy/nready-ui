'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { PermissionDataTableFiltersType } from '@/app/(dashboard)/dashboard/permission/permission.definition';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';

const TRANSLATION_KEYS = ['permission.field.search'] as const;

export const DataTableFiltersPermission = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'permission'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as PermissionDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } =
		useSetFilterValues<PermissionDataTableFiltersType>(
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
			<FormFiltersSearch<PermissionDataTableFiltersType>
				labelText={translations['permission.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersShowDeleted
				dataSource="permission"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="permission" />
		</div>
	);
};
