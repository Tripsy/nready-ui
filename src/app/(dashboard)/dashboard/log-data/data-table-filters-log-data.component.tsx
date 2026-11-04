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
import type { LogDataDataTableFiltersType } from '@/app/(dashboard)/dashboard/log-data/log-data.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type LogCategory,
	LogCategoryEnum,
	type LogLevel,
	LogLevelEnum,
} from '@/models/log-data.model';

const TRANSLATION_KEYS = [
	'log-data.field.category',
	'log-data.field.created_at',
	'log-data.field.level',
	'log-data.field.search',
	...enumTranslationKeys('log-data.enum.level', LogLevelEnum),
	...enumTranslationKeys('log-data.enum.category', LogCategoryEnum),
] as const;

export const DataTableFiltersLogData = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const logCategories = useMemo(
		() =>
			toOptionsFromEnum(LogCategoryEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'log-data.enum.category',
						value,
					),
			}),
		[translations],
	);

	const logLevels = useMemo(
		() =>
			toOptionsFromEnum(LogLevelEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'log-data.enum.level',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'log-data'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as LogDataDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<LogDataDataTableFiltersType>(
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
			<FormFiltersSearch<LogDataDataTableFiltersType>
				labelText={translations['log-data.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<LogDataDataTableFiltersType>
				labelText={translations['log-data.field.category']}
				fieldName="category"
				fieldValue={filters.category.value}
				options={logCategories}
				onChange={(value) =>
					setFilterValue('category', value as LogCategory)
				}
			/>

			<FormFiltersSelect<LogDataDataTableFiltersType>
				labelText={translations['log-data.field.level']}
				fieldName="level"
				fieldValue={filters.level.value}
				options={logLevels}
				onChange={(value) => setFilterValue('level', value as LogLevel)}
			/>

			<FormFiltersDateRange<LogDataDataTableFiltersType>
				labelText={translations['log-data.field.created_at']}
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

			<FormFiltersReset dataSource="log-data" />
		</div>
	);
};
