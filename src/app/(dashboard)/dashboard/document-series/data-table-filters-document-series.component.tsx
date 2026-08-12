'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { DocumentSeriesDataTableFiltersType } from '@/app/(dashboard)/dashboard/document-series/document-series.definition';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type DocumentType,
	DocumentTypeEnum,
	DocumentTypeLabels,
} from '@/models/document-series.model';

const documentTypes = Object.values(DocumentTypeEnum).map((value) => ({
	label: DocumentTypeLabels[value],
	value,
}));

export const DataTableFiltersDocumentSeries = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'document-series'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as DocumentSeriesDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<DocumentSeriesDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
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
			<FormFiltersSearch<DocumentSeriesDataTableFiltersType>
				labelText="ID / Code"
				search={searchGlobal}
			/>

			<FormFiltersSelect<DocumentSeriesDataTableFiltersType>
				labelText="Document type"
				fieldName="document_type"
				fieldValue={filters.document_type.value}
				options={documentTypes}
				onChange={(value) =>
					setFilterValues({ document_type: value as DocumentType })
				}
			/>

			<FormFiltersReset dataSource="document-series" />
		</div>
	);
};
