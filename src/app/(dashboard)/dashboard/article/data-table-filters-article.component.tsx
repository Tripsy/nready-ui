'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { ArticleDataTableFiltersType } from '@/app/(dashboard)/dashboard/article/article.definition';
import { FormComponentCheckbox } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type ArticleFeaturedStatus,
	ArticleFeaturedStatusEnum,
	type ArticleSourceMode,
	ArticleSourceModeEnum,
	type ArticleStatus,
	ArticleStatusEnum,
	type ArticleVisibility,
	ArticleVisibilityEnum,
} from '@/models/article.model';
import {
	type CategoryModel,
	displayCategoryLabel,
} from '@/models/category.model';
import { displayTermValue, type TermModel } from '@/models/term.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';
import { type Language, LanguageEnum } from '@/types/common.type';

const statuses = toOptionsFromEnum(ArticleStatusEnum, {
	formatter: formatEnumLabel,
});

const visibilities = toOptionsFromEnum(ArticleVisibilityEnum, {
	formatter: formatEnumLabel,
});

const featuredStatuses = toOptionsFromEnum(ArticleFeaturedStatusEnum, {
	formatter: formatEnumLabel,
});

const sourceModes = toOptionsFromEnum(ArticleSourceModeEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersArticle = (): JSX.Element => {
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

	const elementIds = useElementIds(['search-is-published'] as const);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValue('global', value),
	});

	const [searchAuthor, setSearchAuthor] = useState(
		filters.author?.value ?? '',
	);

	const onResetAuthor = useCallback(() => {
		setSearchAuthor('');
	}, []);

	const [searchCategory, setSearchCategory] = useState(
		filters.category?.value ?? '',
	);

	const onResetCategory = useCallback(() => {
		setSearchCategory('');
	}, []);

	const [searchTag, setSearchTag] = useState(filters.tag?.value ?? '');

	const onResetTag = useCallback(() => {
		setSearchTag('');
	}, []);

	const resetCallbacks = useMemo(
		() => [
			searchGlobal.onReset,
			onResetAuthor,
			onResetCategory,
			onResetTag,
		],
		[searchGlobal.onReset, onResetAuthor, onResetCategory, onResetTag],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<ArticleDataTableFiltersType>
				labelText="ID / Title / Brief"
				search={searchGlobal}
			/>

			<FormFiltersSelect<ArticleDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as ArticleStatus)
				}
			/>

			<FormFiltersSelect<ArticleDataTableFiltersType>
				labelText="Visibility"
				fieldName="visibility"
				fieldValue={filters.visibility.value}
				options={visibilities}
				onChange={(value) =>
					setFilterValue('visibility', value as ArticleVisibility)
				}
			/>

			<FormFiltersSelect<ArticleDataTableFiltersType>
				labelText="Featured"
				fieldName="featured_status"
				fieldValue={filters.featured_status.value}
				options={featuredStatuses}
				onChange={(value) =>
					setFilterValue(
						'featured_status',
						value as ArticleFeaturedStatus,
					)
				}
			/>

			<FormFiltersSelect<ArticleDataTableFiltersType>
				labelText="Source"
				fieldName="source_mode"
				fieldValue={filters.source_mode.value}
				options={sourceModes}
				onChange={(value) =>
					setFilterValue('source_mode', value as ArticleSourceMode)
				}
			/>

			{/*
			 * The backend joins the translation on this language, so it decides which title the
			 * rows come back with — not just which rows. Left unset it falls back to the
			 * request's language; the control shows that fallback rather than a blank.
			 */}
			<FormFiltersSelect<ArticleDataTableFiltersType>
				labelText="Language"
				fieldName="language"
				fieldValue={filters.language.value ?? getLanguageClient()}
				options={languages}
				onChange={(value) =>
					setFilterValue('language', value as Language)
				}
			/>

			<FormFiltersAutoComplete<ArticleDataTableFiltersType, UserModel>
				labelText="Author"
				fieldName="author"
				fieldNameId="author_id"
				fieldValue={searchAuthor}
				className="pl-8"
				icons={{
					left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchAuthor}
				dataSourceKey="user"
				getOptionLabel={(m) => displayUserLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersAutoComplete<ArticleDataTableFiltersType, CategoryModel>
				labelText="Category"
				fieldName="category"
				fieldNameId="category_id"
				fieldValue={searchCategory}
				className="pl-8"
				icons={{
					left: <Icons.Category className="opacity-40 h-4.5 w-4.5" />,
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

			<FormFiltersAutoComplete<ArticleDataTableFiltersType, TermModel>
				labelText="Tag"
				fieldName="tag"
				fieldNameId="tag_id"
				fieldValue={searchTag}
				className="pl-8"
				icons={{
					left: <Icons.Tag className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchTag}
				dataSourceKey="term"
				filter={{ type: 'tag' }}
				getOptionLabel={(m) => displayTermValue(m)}
				getOptionKey={(m) => m.id}
			/>

			{/*
			 * Only the "on" state is a filter: the backend applies the display window when
			 * `is_published` is true and ignores the flag otherwise, so unchecking it widens the
			 * list back to every status rather than asking for unpublished articles.
			 */}
			<div className="flex self-end pb-3">
				<FormComponentCheckbox
					id={elementIds['search-is-published']}
					fieldName="is_published"
					checked={filters.is_published.value ?? false}
					disabled={false}
					onCheckedChange={(value) =>
						setFilterValue('is_published', value)
					}
				>
					Published only
				</FormComponentCheckbox>
			</div>

			<FormFiltersShowDeleted
				dataSource="article"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="article" />
		</div>
	);
};
