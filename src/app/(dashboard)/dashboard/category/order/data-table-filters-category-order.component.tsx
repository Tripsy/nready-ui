'use client';

import { type JSX, useState } from 'react';
import { useStore } from 'zustand/react';
import { FormFiltersSelect } from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CategoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/category/category.definition';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	CATEGORY_DEFAULT_TYPE,
	type CategoryModel,
	CategoryStatusEnum,
	type CategoryType,
	CategoryTypeEnum,
	displayCategoryLabel,
} from '@/models/category.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import { type Language, LanguageEnum } from '@/types/common.type';

const categoryTypes = toOptionsFromEnum(CategoryTypeEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCategoryOrder = (): JSX.Element => {
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

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
	});

	const type = filters.type.value ?? CATEGORY_DEFAULT_TYPE;
	const language = filters.language.value ?? getLanguageClient();

	// Only the resolved id is a filter; the text the user sees is display state.
	const [parentLabel, setParentLabel] = useState('');
	const [searchParents, setSearchParents] = useState('');

	const { suggestions: parentSuggestions, isFetching: isParentFetching } =
		useRemoteAutocomplete<CategoryModel>({
			query: searchParents,
			queryKey: ['s-parent-category', type, language],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<CategoryModel> | undefined =
					await requestFind('category', {
						filter: {
							term: q,
							type,
							status: CategoryStatusEnum.ACTIVE,
							language,
						},
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSelect<CategoryDataTableFiltersType>
				labelText="Type"
				fieldName="type"
				fieldValue={type}
				options={categoryTypes}
				onChange={(value) => {
					setFilterValue('type', value as CategoryType);
					// A parent from the other type is not part of any group here
					setFilterValue('parent_id', null);
					setParentLabel('');
					setSearchParents('');
				}}
			/>

			<FormFiltersSelect<CategoryDataTableFiltersType>
				labelText="Language"
				fieldName="language"
				fieldValue={language}
				options={languages}
				onChange={(value) =>
					setFilterValue('language', value as Language)
				}
			/>

			<div className="max-w-64 min-w-48">
				<FormComponentAutoComplete<
					CategoryDataTableFiltersType,
					CategoryModel
				>
					labelText="Parent"
					id="filter-category-parent"
					fieldName="parent_id"
					fieldValue={parentLabel}
					className="pl-8"
					placeholderText="Top level"
					disabled={false}
					onInputChange={(value) => {
						setParentLabel(value);
						// Clearing the box falls back to the top-level group
						setFilterValue('parent_id', null);
						setSearchParents(value);
					}}
					autoCompleteProps={{
						suggestions: parentSuggestions,
						isLoading: isParentFetching,
						onSelect: (m) => {
							setParentLabel(
								displayCategoryLabel(m, language, false),
							);
							setFilterValue('parent_id', m.id);
						},
						getOptionLabel: (m) =>
							displayCategoryLabel(m, language, false),
						getOptionKey: (m) => m.id,
					}}
					icons={{
						left: (
							<Icons.Category className="opacity-40 h-4.5 w-4.5" />
						),
					}}
				/>
			</div>
		</div>
	);
};
