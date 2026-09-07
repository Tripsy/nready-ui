'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CategoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/category/category.definition';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	CATEGORY_DEFAULT_TYPE,
	type CategoryStatus,
	CategoryStatusEnum,
	type CategoryType,
	CategoryTypeEnum,
} from '@/models/category.model';
import { type Language, LanguageEnum } from '@/types/common.type';

const categoryTypes = toOptionsFromEnum(CategoryTypeEnum, {
	formatter: formatEnumLabel,
});

const statuses = toOptionsFromEnum(CategoryStatusEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCategory = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'category'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CategoryDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<CategoryDataTableFiltersType>(
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
			<FormFiltersSearch<CategoryDataTableFiltersType>
				labelText="ID / Label"
				search={searchGlobal}
			/>

			<FormFiltersSelect<CategoryDataTableFiltersType>
				labelText="Type"
				fieldName="type"
				fieldValue={filters.type.value ?? CATEGORY_DEFAULT_TYPE}
				options={categoryTypes}
				onChange={(value) =>
					setFilterValue('type', value as CategoryType)
				}
			/>

			<FormFiltersSelect<CategoryDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as CategoryStatus)
				}
			/>

			{/*
			 * The backend joins the contents with an INNER join on this language, so a
			 * category without a translation for it drops out of the list entirely -
			 * the control is a scope, not a display preference.
			 */}
			<FormFiltersSelect<CategoryDataTableFiltersType>
				labelText="Language"
				fieldName="language"
				fieldValue={filters.language.value ?? getLanguageClient()}
				options={languages}
				onChange={(value) =>
					setFilterValue('language', value as Language)
				}
			/>

			<FormFiltersShowDeleted
				dataSource="category"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="category" />
		</div>
	);
};
