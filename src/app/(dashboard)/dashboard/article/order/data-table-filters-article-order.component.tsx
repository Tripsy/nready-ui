'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { ArticleDataTableFiltersType } from '@/app/(dashboard)/dashboard/article/article.definition';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type ArticleFeaturedStatus,
	ArticleFeaturedStatusEnum,
} from '@/models/article.model';
import {
	type CategoryModel,
	displayCategoryLabel,
} from '@/models/category.model';
import { type Language, LanguageEnum } from '@/types/common.type';

const featuredStatuses = toOptionsFromEnum(ArticleFeaturedStatusEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

/**
 * The featured slot picks the group being ordered, and the category picker only appears for the
 * `category` one — a section slot has no subtree to scope to, and the API rejects the pair.
 */
export const DataTableFiltersArticleOrder = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'article'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ArticleDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue, setFilterValues } =
		useSetFilterValues<ArticleDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const [searchCategory, setSearchCategory] = useState(
		filters.category?.value ?? '',
	);

	const onResetCategory = useCallback(() => {
		setSearchCategory('');
	}, []);

	const resetCallbacks = useMemo(() => [onResetCategory], [onResetCategory]);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	const featuredStatus =
		filters.featured_status.value ?? ArticleFeaturedStatusEnum.SECTION;

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSelect<ArticleDataTableFiltersType>
				labelText="Featured slot"
				fieldName="featured_status"
				fieldValue={featuredStatus}
				options={featuredStatuses}
				onChange={(value) => {
					// Switching back to the section slot has to drop the category as well, or
					// the list keeps a scope the write will not accept.
					setFilterValues({
						featured_status: value as ArticleFeaturedStatus,
						category: null,
						category_id: null,
					});

					setSearchCategory('');
				}}
			/>

			{featuredStatus === ArticleFeaturedStatusEnum.CATEGORY && (
				<FormFiltersAutoComplete<
					ArticleDataTableFiltersType,
					CategoryModel
				>
					labelText="Category"
					fieldName="category"
					fieldNameId="category_id"
					fieldValue={searchCategory}
					className="pl-8"
					icons={{
						left: (
							<Icons.Category className="opacity-40 h-4.5 w-4.5" />
						),
					}}
					setFilterValues={setFilterValues}
					setSearch={setSearchCategory}
					dataSourceKey="category"
					filter={{ type: 'article' }}
					getOptionLabel={(m) =>
						displayCategoryLabel(m, getLanguageClient(), false)
					}
					getOptionKey={(m) => m.id}
				/>
			)}

			<FormFiltersSelect<ArticleDataTableFiltersType>
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
