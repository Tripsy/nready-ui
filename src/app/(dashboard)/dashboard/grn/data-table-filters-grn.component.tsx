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
import type { GrnDataTableFiltersType } from '@/app/(dashboard)/dashboard/grn/grn.definition';
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
import { type GrnStatus, GrnStatusEnum } from '@/models/grn.model';
import { displayVendorLabel, type VendorModel } from '@/models/vendor.model';
import {
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';

const TRANSLATION_KEYS = [
	'grn.field.search',
	'grn.field.status',
	'grn.field.warehouse',
	'grn.field.vendor',
	'grn.field.received_at',
	...enumTranslationKeys('grn.status', GrnStatusEnum),
] as const;

/** Only the vendors goods are received from - the same narrowing the form's picker applies. */
const VENDOR_FILTER = { type: 'supplier' };

export const DataTableFiltersGrn = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(GrnStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'grn.status', value),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'grn'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as GrnDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<GrnDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	/*
	 * The backend reads an all-digit term as the receipt number or id, a written reference
	 * (`NIR-42`) as series plus number, and anything else as the supplier's document number.
	 */
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	const [searchWarehouse, setSearchWarehouse] = useState(
		filters.warehouse?.value ?? '',
	);
	const [searchVendor, setSearchVendor] = useState(
		filters.vendor?.value ?? '',
	);

	const onResetPickers = useCallback(() => {
		setSearchWarehouse('');
		setSearchVendor('');
	}, []);

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, onResetPickers],
		[searchGlobal.onReset, onResetPickers],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<GrnDataTableFiltersType>
				labelText={translations['grn.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersAutoComplete<GrnDataTableFiltersType, WarehouseModel>
				labelText={translations['grn.field.warehouse']}
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

			<FormFiltersAutoComplete<GrnDataTableFiltersType, VendorModel>
				labelText={translations['grn.field.vendor']}
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
				filter={VENDOR_FILTER}
				getOptionLabel={(entry) => displayVendorLabel(entry)}
				getOptionKey={(entry) => entry.id}
			/>

			<FormFiltersSelect<GrnDataTableFiltersType>
				labelText={translations['grn.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as GrnStatus })
				}
			/>

			<FormFiltersDateRange<GrnDataTableFiltersType>
				labelText={translations['grn.field.received_at']}
				start={{
					fieldName: 'received_at_start',
					fieldValue: filters.received_at_start.value,
					onSelect: (value) =>
						setFilterValues({ received_at_start: value }),
				}}
				end={{
					fieldName: 'received_at_end',
					fieldValue: filters.received_at_end.value,
					onSelect: (value) =>
						setFilterValues({ received_at_end: value }),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="grn"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="grn" />
		</div>
	);
};
