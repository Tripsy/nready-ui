'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import { FormFiltersSelect } from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { BrandDataTableFiltersType } from '@/app/(dashboard)/dashboard/brand/brand.definition';
import type { TemplateDataTableFiltersType } from '@/app/(dashboard)/dashboard/template/template.definition';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	languageOwnName,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type BrandType, BrandTypeEnum } from '@/models/brand.model';
import { type Language, LanguageEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'brand.field.brand_type',
	'brand.field.language',
	...enumTranslationKeys('brand.enum.type', BrandTypeEnum),
] as const;

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: languageOwnName,
});

export const DataTableFiltersBrandOrder = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const brandTypes = useMemo(
		() =>
			toOptionsFromEnum(BrandTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'brand.enum.type', value),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'brand'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as BrandDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<BrandDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSelect<BrandDataTableFiltersType>
				labelText={translations['brand.field.brand_type']}
				fieldName="brand_type"
				fieldValue={filters.brand_type.value ?? brandTypes[0].value}
				options={brandTypes}
				onChange={(value) =>
					setFilterValue('brand_type', value as BrandType)
				}
			/>

			<FormFiltersSelect<TemplateDataTableFiltersType>
				labelText={translations['brand.field.language']}
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
