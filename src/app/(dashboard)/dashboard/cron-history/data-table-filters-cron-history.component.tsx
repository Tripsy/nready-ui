'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CronHistoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/cron-history/cron-history.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type CronHistoryStatus,
	CronHistoryStatusEnum,
} from '@/models/cron-history.model';

const statuses = toOptionsFromEnum(CronHistoryStatusEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCronHistory = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cron-history'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CronHistoryDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } =
		useSetFilterValues<CronHistoryDataTableFiltersType>(
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
			<FormFiltersSearch<CronHistoryDataTableFiltersType>
				labelText="ID / Label / Content"
				fieldName="global"
				search={searchGlobal}
			/>

			<FormFiltersSelect<CronHistoryDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as CronHistoryStatus)
				}
			/>

			<FormFiltersDateRange<CronHistoryDataTableFiltersType>
				labelText="Start Date"
				start={{
					fieldName: 'start_at_start',
					fieldValue: filters.start_at_start.value,
					onSelect: (value) =>
						setFilterValue('start_at_start', value),
				}}
				end={{
					fieldName: 'start_at_end',
					fieldValue: filters.start_at_end.value,
					onSelect: (value) => setFilterValue('start_at_end', value),
				}}
			/>

			<FormFiltersReset dataSource="cron-history" />
		</div>
	);
};
