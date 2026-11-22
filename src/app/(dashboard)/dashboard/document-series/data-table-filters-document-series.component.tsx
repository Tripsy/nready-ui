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
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type DocumentType,
	DocumentTypeEnum,
} from '@/models/document-series.model';

const TRANSLATION_KEYS = [
	'document-series.field.document_type',
	'document-series.field.search',
	...enumTranslationKeys(
		'document-series.enum.document_type',
		DocumentTypeEnum,
	),
] as const;

export const DataTableFiltersDocumentSeries = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const documentTypes = useMemo(
		() =>
			Object.values(DocumentTypeEnum).map((value) => ({
				label: translateEnumLabel(
					translations,
					'document-series.enum.document_type',
					value,
				),
				value,
			})),
		[translations],
	);

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
				labelText={translations['document-series.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<DocumentSeriesDataTableFiltersType>
				labelText={translations['document-series.field.document_type']}
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
