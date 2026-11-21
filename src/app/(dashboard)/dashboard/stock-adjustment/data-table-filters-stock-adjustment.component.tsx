'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { StockAdjustmentDataTableFiltersType } from '@/app/(dashboard)/dashboard/stock-adjustment/stock-adjustment.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import {
	type StockAdjustmentDirection,
	StockAdjustmentDirectionEnum,
	type StockAdjustmentReason,
	StockAdjustmentReasonEnum,
	type StockAdjustmentStatus,
	StockAdjustmentStatusEnum,
} from '@/models/stock-adjustment.model';
import {
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';

const TRANSLATION_KEYS = [
	'stock-adjustment.field.warehouse',
	'stock-adjustment.field.variant',
	'stock-adjustment.field.direction',
	'stock-adjustment.field.reason',
	'stock-adjustment.field.status',
	'stock-adjustment.field.created_at',
	...enumTranslationKeys(
		'stock-adjustment.enum.direction',
		StockAdjustmentDirectionEnum,
	),
	...enumTranslationKeys(
		'stock-adjustment.enum.reason',
		StockAdjustmentReasonEnum,
	),
	...enumTranslationKeys(
		'stock-adjustment.status',
		StockAdjustmentStatusEnum,
	),
] as const;

/** Only variants that track stock can ever be adjusted. */
const VARIANT_FILTER = { track_stock: 'true' };

export const DataTableFiltersStockAdjustment = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const directions = useMemo(
		() =>
			toOptionsFromEnum(StockAdjustmentDirectionEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'stock-adjustment.enum.direction',
						value,
					),
			}),
		[translations],
	);

	const reasons = useMemo(
		() =>
			toOptionsFromEnum(StockAdjustmentReasonEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'stock-adjustment.enum.reason',
						value,
					),
			}),
		[translations],
	);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(StockAdjustmentStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'stock-adjustment.status',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'stock-adjustment'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as StockAdjustmentDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<StockAdjustmentDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const [searchWarehouse, setSearchWarehouse] = useState(
		filters.warehouse?.value ?? '',
	);
	const [searchVariant, setSearchVariant] = useState(
		filters.variant?.value ?? '',
	);

	const onResetPickers = useCallback(() => {
		setSearchWarehouse('');
		setSearchVariant('');
	}, []);

	const resetCallbacks = useMemo(() => [onResetPickers], [onResetPickers]);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersAutoComplete<
				StockAdjustmentDataTableFiltersType,
				WarehouseModel
			>
				labelText={translations['stock-adjustment.field.warehouse']}
				fieldName="warehouse"
				fieldNameId="warehouse_id"
				fieldValue={searchWarehouse}
				className="pl-8"
				icons={{
					left: (
						<Icons.Warehouse className="opacity-40 h-4.5 w-4.5" />
					),
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchWarehouse}
				dataSourceKey="warehouse"
				getOptionLabel={(entry) => displayWarehouseLabel(entry)}
				getOptionKey={(entry) => entry.id}
			/>

			<FormFiltersAutoComplete<
				StockAdjustmentDataTableFiltersType,
				ProductVariantModel
			>
				labelText={translations['stock-adjustment.field.variant']}
				fieldName="variant"
				fieldNameId="variant_id"
				fieldValue={searchVariant}
				className="pl-8"
				icons={{
					left: <Icons.Product className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchVariant}
				dataSourceKey="product-variant"
				filter={VARIANT_FILTER}
				getOptionLabel={(entry) => displayProductVariantLabel(entry)}
				getOptionKey={(entry) => entry.id}
			/>

			<FormFiltersSelect<StockAdjustmentDataTableFiltersType>
				labelText={translations['stock-adjustment.field.direction']}
				fieldName="adjustment_direction"
				fieldValue={filters.adjustment_direction.value}
				options={directions}
				onChange={(value) =>
					setFilterValues({
						adjustment_direction: value as StockAdjustmentDirection,
					})
				}
			/>

			<FormFiltersSelect<StockAdjustmentDataTableFiltersType>
				labelText={translations['stock-adjustment.field.reason']}
				fieldName="reason"
				fieldValue={filters.reason.value}
				options={reasons}
				onChange={(value) =>
					setFilterValues({ reason: value as StockAdjustmentReason })
				}
			/>

			<FormFiltersSelect<StockAdjustmentDataTableFiltersType>
				labelText={translations['stock-adjustment.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as StockAdjustmentStatus })
				}
			/>

			<FormFiltersDateRange<StockAdjustmentDataTableFiltersType>
				labelText={translations['stock-adjustment.field.created_at']}
				start={{
					fieldName: 'created_at_start',
					fieldValue: filters.created_at_start.value,
					onSelect: (value) =>
						setFilterValues({ created_at_start: value }),
				}}
				end={{
					fieldName: 'created_at_end',
					fieldValue: filters.created_at_end.value,
					onSelect: (value) =>
						setFilterValues({ created_at_end: value }),
				}}
			/>

			<FormFiltersReset dataSource="stock-adjustment" />
		</div>
	);
};
