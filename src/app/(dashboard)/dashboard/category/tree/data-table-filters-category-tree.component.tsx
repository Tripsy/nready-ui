'use client';

import type { JSX } from 'react';
import { useStore } from 'zustand/react';
import { FormFiltersSelect } from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CategoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/category/category.definition';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	CATEGORY_DEFAULT_TYPE,
	type CategoryType,
	CategoryTypeEnum,
} from '@/models/category.model';
import { type Language, LanguageEnum } from '@/types/common.type';

const categoryTypes = toOptionsFromEnum(CategoryTypeEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

/**
 * Type and language only. There is no parent filter here - a tree is rooted by definition, and
 * a status filter would contradict the page, which shows the active hierarchy.
 */
export const DataTableFiltersCategoryTree = (): JSX.Element => {
	const { dataTableStore } = useDataTable<'category'>();

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

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
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
				labelText="Language"
				fieldName="language"
				fieldValue={filters.language.value ?? getLanguageClient()}
				options={languages}
				onChange={(value) =>
					setFilterValue('language', value as Language)
				}
			/>
		</div>
	);
};
