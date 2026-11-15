'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { VatRateDataTableFiltersType } from '@/app/(dashboard)/dashboard/vat-rate/vat-rate.definition';
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
	type VatRateCategory,
	VatRateCategoryEnum,
} from '@/models/vat-rate.model';

const TRANSLATION_KEYS = [
	'vat-rate.field.search',
	'vat-rate.field.category',
	...enumTranslationKeys('vat-rate.enum.category', VatRateCategoryEnum),
] as const;

export const DataTableFiltersVatRate = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const categories = useMemo(
		() =>
			toOptionsFromEnum(VatRateCategoryEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'vat-rate.enum.category',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'vat-rate'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as VatRateDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<VatRateDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	/*
	 * The backend's `filterByTerm` matches the id exactly for an all-digit term, and otherwise
	 * the country code or the notes, from three characters - so a two-letter country code alone
	 * is too short to search, and the list is small enough to read by its country column.
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
			<FormFiltersSearch<VatRateDataTableFiltersType>
				labelText={translations['vat-rate.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<VatRateDataTableFiltersType>
				labelText={translations['vat-rate.field.category']}
				fieldName="category"
				fieldValue={filters.category.value}
				options={categories}
				onChange={(value) =>
					setFilterValues({ category: value as VatRateCategory })
				}
			/>

			<FormFiltersReset dataSource="vat-rate" />
		</div>
	);
};
