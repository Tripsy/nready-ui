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
import type { ShippingDataTableFiltersType } from '@/app/(dashboard)/dashboard/shipping/shipping.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type ShippingMethod,
	ShippingMethodEnum,
	type ShippingScope,
	ShippingScopeEnum,
	type ShippingStatus,
	ShippingStatusEnum,
} from '@/models/shipping.model';

const statuses = toOptionsFromEnum(ShippingStatusEnum, {
	formatter: formatEnumLabel,
});

const methods = toOptionsFromEnum(ShippingMethodEnum, {
	formatter: formatEnumLabel,
});

const scopes = toOptionsFromEnum(ShippingScopeEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersShipping = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'shipping'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ShippingDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<ShippingDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	/*
	 * Also the order filter: the backend reads a bare number as the shipment id, the order id or the
	 * order's document number, a written reference (`ORD-1183`) as that order, and anything else as
	 * the tracking number - the string somebody quotes when they ask where a parcel is.
	 */
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
			<FormFiltersSearch<ShippingDataTableFiltersType>
				labelText="ID / Order / Tracking number"
				search={searchGlobal}
			/>

			<FormFiltersSelect<ShippingDataTableFiltersType>
				labelText="Type"
				fieldName="scope"
				fieldValue={filters.scope.value}
				options={scopes}
				onChange={(value) =>
					setFilterValues({ scope: value as ShippingScope })
				}
			/>

			<FormFiltersSelect<ShippingDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as ShippingStatus })
				}
			/>

			<FormFiltersSelect<ShippingDataTableFiltersType>
				labelText="Method"
				fieldName="method"
				fieldValue={filters.method.value}
				options={methods}
				onChange={(value) =>
					setFilterValues({ method: value as ShippingMethod })
				}
			/>

			<FormFiltersShowDeleted
				dataSource="shipping"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="shipping" />
		</div>
	);
};
