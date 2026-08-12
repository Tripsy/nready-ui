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
import type { PlaceDataTableFiltersType } from '@/app/(dashboard)/dashboard/place/place.definition';
import type { TemplateDataTableFiltersType } from '@/app/(dashboard)/dashboard/template/template.definition';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { type PlaceType, PlaceTypeEnum } from '@/models/place.model';
import { type Language, LanguageEnum } from '@/types/common.type';

const placeTypes = toOptionsFromEnum(PlaceTypeEnum, {
	formatter: formatEnumLabel,
});

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersPlace = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'place'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as PlaceDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<PlaceDataTableFiltersType>(
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
			<FormFiltersSearch<PlaceDataTableFiltersType>
				labelText="ID / Name"
				search={searchGlobal}
			/>

			<FormFiltersSelect<PlaceDataTableFiltersType>
				labelText="Type"
				fieldName="place_type"
				fieldValue={filters.place_type.value}
				options={placeTypes}
				onChange={(value) =>
					setFilterValue('place_type', value as PlaceType)
				}
			/>

			<FormFiltersSelect<TemplateDataTableFiltersType>
				labelText="Language"
				fieldName="language"
				fieldValue={filters.language.value ?? getLanguageClient()}
				options={languages}
				onChange={(value) =>
					setFilterValue('language', value as Language)
				}
			/>

			<FormFiltersShowDeleted
				dataSource="place"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="place" />
		</div>
	);
};
