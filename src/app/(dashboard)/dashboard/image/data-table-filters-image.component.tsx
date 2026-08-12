'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { ImageDataTableFiltersType } from '@/app/(dashboard)/dashboard/image/image.definition';
import type { LogHistoryDataTableFiltersType } from '@/app/(dashboard)/dashboard/log-history/log-history.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type ImageSection,
	ImageSectionEnum,
	type ImageType,
	ImageTypeEnum,
} from '@/models/image.model';

const sections = toOptionsFromEnum(ImageSectionEnum, {
	formatter: formatEnumLabel,
});

const imageTypes = toOptionsFromEnum(ImageTypeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersImage = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'image'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ImageDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<ImageDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	const searchEntityId = useSearchFilter({
		initialValue: filters.entity_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('entity_id', value),
	});

	const resetCallbacks = useMemo(
		() => [searchEntityId.onReset],
		[searchEntityId.onReset],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSelect<ImageDataTableFiltersType>
				labelText="Section"
				fieldName="section"
				fieldValue={filters.section.value}
				options={sections}
				onChange={(value) =>
					setFilterValue('section', value as ImageSection)
				}
			/>

			<FormFiltersSearch<LogHistoryDataTableFiltersType>
				labelText="Entity ID"
				fieldName="entity_id"
				search={searchEntityId}
			/>

			<FormFiltersSelect<ImageDataTableFiltersType>
				labelText="Type"
				fieldName="image_type"
				fieldValue={filters.image_type.value}
				options={imageTypes}
				onChange={(value) =>
					setFilterValue('image_type', value as ImageType)
				}
			/>

			<FormFiltersReset dataSource="image" />
		</div>
	);
};
