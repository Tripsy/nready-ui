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
import type { ProductDataTableFiltersType } from '@/app/(dashboard)/dashboard/product/product.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { BrandModel } from '@/models/brand.model';
import {
	type ProductComposition,
	ProductCompositionEnum,
	type ProductSaleStatus,
	ProductSaleStatusEnum,
	type ProductType,
	ProductTypeEnum,
	type ProductWorkflow,
	ProductWorkflowEnum,
} from '@/models/product.model';

const TRANSLATION_KEYS = [
	'product.field.brand',
	'product.field.composition',
	'product.field.sale_status',
	'product.field.search',
	'product.field.type',
	'product.field.workflow',
	...enumTranslationKeys('product.enum.workflow', ProductWorkflowEnum),
	...enumTranslationKeys('product.enum.type', ProductTypeEnum),
	...enumTranslationKeys('product.enum.composition', ProductCompositionEnum),
	...enumTranslationKeys('product.enum.sale_status', ProductSaleStatusEnum),
] as const;

export const DataTableFiltersProduct = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const saleStatuses = useMemo(
		() =>
			toOptionsFromEnum(ProductSaleStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'product.enum.sale_status',
						value,
					),
			}),
		[translations],
	);

	const compositions = useMemo(
		() =>
			toOptionsFromEnum(ProductCompositionEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'product.enum.composition',
						value,
					),
			}),
		[translations],
	);

	const types = useMemo(
		() =>
			toOptionsFromEnum(ProductTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'product.enum.type',
						value,
					),
			}),
		[translations],
	);

	const workflows = useMemo(
		() =>
			toOptionsFromEnum(ProductWorkflowEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'product.enum.workflow',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'product'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ProductDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<ProductDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	const [searchBrand, setSearchBrand] = useState(filters.brand?.value ?? '');

	const onResetBrand = useCallback(() => {
		setSearchBrand('');
	}, []);

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, onResetBrand],
		[searchGlobal.onReset, onResetBrand],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<ProductDataTableFiltersType>
				labelText={translations['product.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<ProductDataTableFiltersType>
				labelText={translations['product.field.workflow']}
				fieldName="workflow"
				fieldValue={filters.workflow.value}
				options={workflows}
				onChange={(value) =>
					setFilterValues({ workflow: value as ProductWorkflow })
				}
			/>

			<FormFiltersSelect<ProductDataTableFiltersType>
				labelText={translations['product.field.type']}
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValues({ type: value as ProductType })
				}
			/>

			<FormFiltersSelect<ProductDataTableFiltersType>
				labelText={translations['product.field.composition']}
				fieldName="composition"
				fieldValue={filters.composition.value}
				options={compositions}
				onChange={(value) =>
					setFilterValues({
						composition: value as ProductComposition,
					})
				}
			/>

			<FormFiltersSelect<ProductDataTableFiltersType>
				labelText={translations['product.field.sale_status']}
				fieldName="sale_status"
				fieldValue={filters.sale_status.value}
				options={saleStatuses}
				onChange={(value) =>
					setFilterValues({
						sale_status: value as ProductSaleStatus,
					})
				}
			/>

			<FormFiltersAutoComplete<ProductDataTableFiltersType, BrandModel>
				labelText={translations['product.field.brand']}
				fieldName="brand"
				fieldNameId="brand_id"
				fieldValue={searchBrand}
				className="pl-8"
				icons={{
					left: <Icons.Brand className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchBrand}
				dataSourceKey="brand"
				getOptionLabel={(m) => m.name}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersShowDeleted
				dataSource="product"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="product" />
		</div>
	);
};
