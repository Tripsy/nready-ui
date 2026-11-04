'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CashFlowDataTableFiltersType } from '@/app/(dashboard)/dashboard/cash-flow/cash-flow.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	formatEnumLabel,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type CashFlowCategory,
	CashFlowCategoryEnum,
	CashFlowCategoryTypeEnum,
	type CashFlowDirection,
	CashFlowDirectionEnum,
	type CashFlowMethod,
	CashFlowMethodEnum,
	type CashFlowStatus,
	CashFlowStatusEnum,
	groupedCategoryOptions,
} from '@/models/cash-flow.model';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import { displayVendorLabel, type VendorModel } from '@/models/vendor.model';
import { type Currency, CurrencyEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'cash-flow.field.category',
	'cash-flow.field.client',
	'cash-flow.field.created_at',
	'cash-flow.field.currency',
	'cash-flow.field.direction',
	'cash-flow.field.method',
	'cash-flow.field.search',
	'cash-flow.field.status',
	'cash-flow.field.vendor',
	...enumTranslationKeys('cash-flow.status', CashFlowStatusEnum),
	...enumTranslationKeys('cash-flow.enum.direction', CashFlowDirectionEnum),
	...enumTranslationKeys('cash-flow.enum.method', CashFlowMethodEnum),
	...enumTranslationKeys(
		'cash-flow.enum.category_type',
		CashFlowCategoryTypeEnum,
	),
	...enumTranslationKeys('cash-flow.enum.category', CashFlowCategoryEnum),
] as const;

const currencies = toOptionsFromEnum(CurrencyEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersCashFlow = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const categoryOptions = useMemo(
		() =>
			groupedCategoryOptions({
				type: (value) =>
					translateEnumLabel(
						translations,
						'cash-flow.enum.category_type',
						value,
					),
				category: (value) =>
					translateEnumLabel(
						translations,
						'cash-flow.enum.category',
						value,
					),
			}),
		[translations],
	);

	const methods = useMemo(
		() =>
			toOptionsFromEnum(CashFlowMethodEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'cash-flow.enum.method',
						value,
					),
			}),
		[translations],
	);

	const directions = useMemo(
		() =>
			toOptionsFromEnum(CashFlowDirectionEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'cash-flow.enum.direction',
						value,
					),
			}),
		[translations],
	);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(CashFlowStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'cash-flow.status', value),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cash-flow'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CashFlowDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<CashFlowDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) =>
			setFilterValues({
				global: value,
			}),
	});

	const [searchClient, setSearchClient] = useState(
		filters.client?.value ?? '',
	);

	const onResetClient = useCallback(() => {
		setSearchClient('');
	}, []);

	const [searchVendor, setSearchVendor] = useState(
		filters.vendor?.value ?? '',
	);

	const onResetVendor = useCallback(() => {
		setSearchVendor('');
	}, []);

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, onResetClient, onResetVendor],
		[searchGlobal.onReset, onResetClient, onResetVendor],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.direction']}
				fieldName="direction"
				fieldValue={filters.direction.value}
				options={directions}
				onChange={(value) =>
					setFilterValues({
						direction: value as CashFlowDirection,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.category']}
				fieldName="category"
				fieldValue={filters.category.value}
				options={categoryOptions}
				onChange={(value) =>
					setFilterValues({
						category: value as CashFlowCategory,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.method']}
				fieldName="method"
				fieldValue={filters.method?.value ?? null}
				options={methods}
				onChange={(value) =>
					setFilterValues({
						method: value as CashFlowMethod,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.currency']}
				fieldName="currency"
				fieldValue={filters.currency.value}
				options={currencies}
				onChange={(value) =>
					setFilterValues({
						currency: value as Currency,
					})
				}
			/>

			<FormFiltersSelect<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({
						status: value as CashFlowStatus,
					})
				}
			/>

			<FormFiltersDateRange<CashFlowDataTableFiltersType>
				labelText={translations['cash-flow.field.created_at']}
				start={{
					fieldName: 'create_at_start',
					fieldValue: filters.create_at_start.value,
					onSelect: (value) =>
						setFilterValues({
							create_at_start: value,
						}),
				}}
				end={{
					fieldName: 'create_at_end',
					fieldValue: filters.create_at_end.value,
					onSelect: (value) =>
						setFilterValues({
							create_at_end: value,
						}),
				}}
			/>

			<FormFiltersAutoComplete<CashFlowDataTableFiltersType, ClientModel>
				labelText={translations['cash-flow.field.client']}
				fieldName="client"
				fieldNameId="client_id"
				fieldValue={searchClient}
				className="pl-8"
				icons={{
					left: <Icons.Client className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchClient}
				dataSourceKey="client"
				getOptionLabel={(m) => displayClientLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersAutoComplete<CashFlowDataTableFiltersType, VendorModel>
				labelText={translations['cash-flow.field.vendor']}
				fieldName="vendor"
				fieldNameId="vendor_id"
				fieldValue={searchVendor}
				className="pl-8"
				icons={{
					left: <Icons.Vendor className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchVendor}
				dataSourceKey="vendor"
				getOptionLabel={(m) => displayVendorLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersShowDeleted
				dataSource="cash-flow"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({
						is_deleted: value,
					})
				}
			/>

			<FormFiltersReset dataSource="cash-flow" />
		</div>
	);
};
