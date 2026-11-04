'use client';

import type React from 'react';
import { useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { TemplateDataTableFiltersType } from '@/app/(dashboard)/dashboard/template/template.definition';
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
import { type TemplateType, TemplateTypeEnum } from '@/models/template.model';
import { LanguageEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'template.field.language',
	'template.field.search',
	'template.field.type',
	...enumTranslationKeys('template.enum.type', TemplateTypeEnum),
] as const;

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: languageOwnName,
});

export const DataTableFiltersTemplate = (): React.JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const types = useMemo(
		() =>
			toOptionsFromEnum(TemplateTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'template.enum.type',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'template'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as TemplateDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<TemplateDataTableFiltersType>(
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
			<FormFiltersSearch<TemplateDataTableFiltersType>
				labelText={translations['template.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<TemplateDataTableFiltersType>
				labelText={translations['template.field.language']}
				fieldName="language"
				fieldValue={filters.language.value}
				options={languages}
				onChange={(value) => setFilterValue('language', value)}
			/>

			<FormFiltersSelect<TemplateDataTableFiltersType>
				labelText={translations['template.field.type']}
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValue('type', value as TemplateType)
				}
			/>

			<FormFiltersShowDeleted
				dataSource="template"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="template" />
		</div>
	);
};
