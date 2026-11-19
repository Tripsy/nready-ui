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
import type { WarehouseMovementDataTableFiltersType } from '@/app/(dashboard)/dashboard/warehouse-movement/warehouse-movement.definition';
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
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';
import {
	type WarehouseMovementSource,
	WarehouseMovementSourceEnum,
	type WarehouseMovementType,
	WarehouseMovementTypeEnum,
} from '@/models/warehouse-movement.model';

const TRANSLATION_KEYS = [
	'warehouse-movement.field.warehouse',
	'warehouse-movement.field.variant',
	'warehouse-movement.field.movement_type',
	'warehouse-movement.field.source_type',
	'warehouse-movement.field.occurred_at',
	...enumTranslationKeys(
		'warehouse-movement.enum.movement_type',
		WarehouseMovementTypeEnum,
	),
	...enumTranslationKeys(
		'warehouse-movement.enum.source_type',
		WarehouseMovementSourceEnum,
	),
] as const;

/** Only variants whose stock is tracked ever reach the ledger. */
const VARIANT_FILTER = { track_stock: 'true' };

export const DataTableFiltersWarehouseMovement = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const movementTypes = useMemo(
		() =>
			toOptionsFromEnum(WarehouseMovementTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'warehouse-movement.enum.movement_type',
						value,
					),
			}),
		[translations],
	);

	const sourceTypes = useMemo(
		() =>
			toOptionsFromEnum(WarehouseMovementSourceEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'warehouse-movement.enum.source_type',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'warehouse-movement'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as WarehouseMovementDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<WarehouseMovementDataTableFiltersType>(
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
				WarehouseMovementDataTableFiltersType,
				WarehouseModel
			>
				labelText={translations['warehouse-movement.field.warehouse']}
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
				WarehouseMovementDataTableFiltersType,
				ProductVariantModel
			>
				labelText={translations['warehouse-movement.field.variant']}
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

			<FormFiltersSelect<WarehouseMovementDataTableFiltersType>
				labelText={
					translations['warehouse-movement.field.movement_type']
				}
				fieldName="movement_type"
				fieldValue={filters.movement_type.value}
				options={movementTypes}
				onChange={(value) =>
					setFilterValues({
						movement_type: value as WarehouseMovementType,
					})
				}
			/>

			<FormFiltersSelect<WarehouseMovementDataTableFiltersType>
				labelText={translations['warehouse-movement.field.source_type']}
				fieldName="source_type"
				fieldValue={filters.source_type.value}
				options={sourceTypes}
				onChange={(value) =>
					setFilterValues({
						source_type: value as WarehouseMovementSource,
					})
				}
			/>

			<FormFiltersDateRange<WarehouseMovementDataTableFiltersType>
				labelText={translations['warehouse-movement.field.occurred_at']}
				start={{
					fieldName: 'occurred_at_start',
					fieldValue: filters.occurred_at_start.value,
					onSelect: (value) =>
						setFilterValues({ occurred_at_start: value }),
				}}
				end={{
					fieldName: 'occurred_at_end',
					fieldValue: filters.occurred_at_end.value,
					onSelect: (value) =>
						setFilterValues({ occurred_at_end: value }),
				}}
			/>

			<FormFiltersReset dataSource="warehouse-movement" />
		</div>
	);
};
