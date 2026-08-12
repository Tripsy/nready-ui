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
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { type TemplateType, TemplateTypeEnum } from '@/models/template.model';
import { LanguageEnum } from '@/types/common.type';

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

const types = toOptionsFromEnum(TemplateTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersTemplate = (): React.JSX.Element => {
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
				labelText="ID / Label / Content"
				search={searchGlobal}
			/>

			<FormFiltersSelect<TemplateDataTableFiltersType>
				labelText="Language"
				fieldName="language"
				fieldValue={filters.language.value}
				options={languages}
				onChange={(value) => setFilterValue('language', value)}
			/>

			<FormFiltersSelect<TemplateDataTableFiltersType>
				labelText="Type"
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
