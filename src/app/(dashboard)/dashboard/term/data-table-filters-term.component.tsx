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
import type { TermDataTableFiltersType } from '@/app/(dashboard)/dashboard/term/term.definition';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	languageOwnName,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type TermType, TermTypeEnum } from '@/models/term.model';
import { LanguageEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'term.field.language',
	'term.field.search',
	'term.field.type',
	...enumTranslationKeys('term.enum.type', TermTypeEnum),
] as const;

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: languageOwnName,
});

export const DataTableFiltersTerm = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const types = useMemo(
		() =>
			toOptionsFromEnum(TermTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'term.enum.type', value),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'term'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as TermDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<TermDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	// The backend matches the term against `id` when numeric, else the wording in any language
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
			<FormFiltersSearch<TermDataTableFiltersType>
				labelText={translations['term.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<TermDataTableFiltersType>
				labelText={translations['term.field.type']}
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) => setFilterValue('type', value as TermType)}
			/>

			<FormFiltersSelect<TermDataTableFiltersType>
				labelText={translations['term.field.language']}
				fieldName="language"
				fieldValue={filters.language.value ?? getLanguageClient()}
				options={languages}
				onChange={(value) => setFilterValue('language', value)}
			/>

			<FormFiltersShowDeleted
				dataSource="term"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="term" />
		</div>
	);
};
