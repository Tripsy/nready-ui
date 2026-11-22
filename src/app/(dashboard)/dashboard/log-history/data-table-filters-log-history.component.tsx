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
import type { LogHistoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/log-history/log-history.definition';
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
	LogHistoryActions,
	LogHistoryEntities,
	type LogHistorySource,
	LogHistorySourceEnum,
} from '@/models/log-history.model';

const TRANSLATION_KEYS = [
	'log-history.field.action',
	'log-history.field.entity',
	'log-history.field.recorded_at',
	'log-history.field.request_id',
	'log-history.field.entity_id',
	'log-history.field.source',
	...enumTranslationKeys('log-history.enum.source', LogHistorySourceEnum),
	...enumTranslationKeys('log-history.enum.entity', LogHistoryEntities),
	...enumTranslationKeys('log-history.enum.action', LogHistoryActions),
] as const;

export const DataTableFiltersLogHistory = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const actions = useMemo(
		() =>
			LogHistoryActions.map((v) => ({
				label: translateEnumLabel(
					translations,
					'log-history.enum.action',
					v,
				),
				value: v,
			})),
		[translations],
	);

	const entities = useMemo(
		() =>
			LogHistoryEntities.map((v) => ({
				label: translateEnumLabel(
					translations,
					'log-history.enum.entity',
					v,
				),
				value: v,
			})),
		[translations],
	);

	const sources = useMemo(
		() =>
			toOptionsFromEnum(LogHistorySourceEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'log-history.enum.source',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'log-history'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as LogHistoryDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } =
		useSetFilterValues<LogHistoryDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const searchRequestId = useSearchFilter({
		initialValue: filters.request_id.value ?? '',
		debounceDelay: 1000,
		minLength: 36,
		onSearch: (value) => setFilterValue('request_id', value),
	});

	const searchEntityId = useSearchFilter({
		initialValue: filters.entity_id.value ?? '',
		debounceDelay: 1000,
		minLength: 2,
		onSearch: (value) => setFilterValue('entity_id', value),
	});

	const resetCallbacks = useMemo(
		() => [searchRequestId.onReset, searchEntityId.onReset],
		[searchRequestId.onReset, searchEntityId.onReset],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<LogHistoryDataTableFiltersType>
				labelText={translations['log-history.field.request_id']}
				fieldName="request_id"
				search={searchRequestId}
			/>

			<FormFiltersSelect<LogHistoryDataTableFiltersType>
				labelText={translations['log-history.field.entity']}
				fieldName="entity"
				fieldValue={filters.entity.value}
				options={entities}
				onChange={(value) => setFilterValue('entity', value)}
			/>

			<FormFiltersSearch<LogHistoryDataTableFiltersType>
				labelText={translations['log-history.field.entity_id']}
				fieldName="entity_id"
				search={searchEntityId}
			/>

			<FormFiltersSelect<LogHistoryDataTableFiltersType>
				labelText={translations['log-history.field.action']}
				fieldName="action"
				fieldValue={filters.action.value}
				options={actions}
				onChange={(value) => setFilterValue('action', value)}
			/>

			<FormFiltersSelect<LogHistoryDataTableFiltersType>
				labelText={translations['log-history.field.source']}
				fieldName="source"
				fieldValue={filters.source.value}
				options={sources}
				onChange={(value) =>
					setFilterValue('source', value as LogHistorySource)
				}
			/>

			<FormFiltersDateRange<LogHistoryDataTableFiltersType>
				labelText={translations['log-history.field.recorded_at']}
				start={{
					fieldName: 'recorded_at_start',
					fieldValue: filters.recorded_at_start.value,
					onSelect: (value) =>
						setFilterValue('recorded_at_start', value),
				}}
				end={{
					fieldName: 'recorded_at_end',
					fieldValue: filters.recorded_at_end.value,
					onSelect: (value) =>
						setFilterValue('recorded_at_end', value),
				}}
			/>

			<FormFiltersReset dataSource="log-history" />
		</div>
	);
};
