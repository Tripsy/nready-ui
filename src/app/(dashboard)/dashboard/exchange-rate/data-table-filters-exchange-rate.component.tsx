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
import type { ExchangeRateDataTableFiltersType } from '@/app/(dashboard)/dashboard/exchange-rate/exchange-rate.definition';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type ExchangeRateSource,
	ExchangeRateSourceEnum,
} from '@/models/exchange-rate.model';

const TRANSLATION_KEYS = [
	'exchange-rate.field.rate_date',
	'exchange-rate.field.search',
	'exchange-rate.field.source',
	...enumTranslationKeys('exchange-rate.enum.source', ExchangeRateSourceEnum),
] as const;

export const DataTableFiltersExchangeRate = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const sources = useMemo(
		() =>
			Object.values(ExchangeRateSourceEnum).map((value) => ({
				label: translateEnumLabel(
					translations,
					'exchange-rate.enum.source',
					value,
				),
				value,
			})),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'exchange-rate'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ExchangeRateDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<ExchangeRateDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	/*
	 * The backend's `filterByTerm` matches the id exactly for an all-digit term, and otherwise
	 * both currency columns and the provider - which is why there is no separate currency
	 * control: a three-letter term already selects one.
	 */
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
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
			<FormFiltersSearch<ExchangeRateDataTableFiltersType>
				labelText={translations['exchange-rate.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<ExchangeRateDataTableFiltersType>
				labelText={translations['exchange-rate.field.source']}
				fieldName="source"
				fieldValue={filters.source.value}
				options={sources}
				onChange={(value) =>
					setFilterValues({ source: value as ExchangeRateSource })
				}
			/>

			<FormFiltersDateRange<ExchangeRateDataTableFiltersType>
				labelText={translations['exchange-rate.field.rate_date']}
				start={{
					fieldName: 'rate_date_start',
					fieldValue: filters.rate_date_start.value,
					onSelect: (value) =>
						setFilterValues({
							rate_date_start: value,
						}),
				}}
				end={{
					fieldName: 'rate_date_end',
					fieldValue: filters.rate_date_end.value,
					onSelect: (value) =>
						setFilterValues({
							rate_date_end: value,
						}),
				}}
			/>

			<FormFiltersReset dataSource="exchange-rate" />
		</div>
	);
};
