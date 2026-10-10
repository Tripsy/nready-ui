'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { InvoiceDataTableFiltersType } from '@/app/(dashboard)/dashboard/invoice/invoice.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type InvoicePaymentStatus,
	InvoicePaymentStatusEnum,
	type InvoiceScope,
	InvoiceScopeEnum,
	type InvoiceStatus,
	InvoiceStatusEnum,
} from '@/models/invoice.model';
import { type Currency, CurrencyEnum } from '@/types/common.type';

const statuses = toOptionsFromEnum(InvoiceStatusEnum, {
	formatter: formatEnumLabel,
});

const paymentStatuses = toOptionsFromEnum(InvoicePaymentStatusEnum, {
	formatter: formatEnumLabel,
});

const scopes = toOptionsFromEnum(InvoiceScopeEnum, {
	formatter: formatEnumLabel,
});

const currencies = toOptionsFromEnum(CurrencyEnum, {
	formatter: formatEnumLabel,
});

/**
 * "Late right now" - stamped as overdue and still unsettled. `overdue_at` alone would also match
 * a document that was late once and has since been paid, which is not what a dunning run reads.
 */
const overdueOptions = [
	{ label: 'Overdue', value: 'true' },
	{ label: 'Not overdue', value: 'false' },
];

const reversalOptions = [
	{ label: 'Reversals only', value: 'true' },
	{ label: 'Originals only', value: 'false' },
];

export const DataTableFiltersInvoice = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'invoice'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as InvoiceDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } = useSetFilterValues<InvoiceDataTableFiltersType>(
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
			{/* A number matches the printed reference or the id; text matches the series code or the notes */}
			<FormFiltersSearch<InvoiceDataTableFiltersType>
				labelText="Number / Series / Notes"
				search={searchGlobal}
			/>

			<FormFiltersSelect<InvoiceDataTableFiltersType>
				labelText="Scope"
				fieldName="scope"
				fieldValue={filters.scope.value}
				options={scopes}
				onChange={(value) =>
					setFilterValues({
						scope: value as InvoiceScope,
					})
				}
			/>

			<FormFiltersSelect<InvoiceDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({
						status: value as InvoiceStatus,
					})
				}
			/>

			<FormFiltersSelect<InvoiceDataTableFiltersType>
				labelText="Payment"
				fieldName="payment_status"
				fieldValue={filters.payment_status.value}
				options={paymentStatuses}
				onChange={(value) =>
					setFilterValues({
						payment_status: value as InvoicePaymentStatus,
					})
				}
			/>

			<FormFiltersSelect<InvoiceDataTableFiltersType>
				labelText="Currency"
				fieldName="currency"
				fieldValue={filters.currency.value}
				options={currencies}
				onChange={(value) =>
					setFilterValues({
						currency: value as Currency,
					})
				}
			/>

			<FormFiltersSelect<InvoiceDataTableFiltersType>
				labelText="Storno"
				fieldName="is_reversal"
				fieldValue={
					filters.is_reversal.value === null
						? null
						: String(filters.is_reversal.value)
				}
				options={reversalOptions}
				onChange={(value) =>
					setFilterValues({
						is_reversal: value === null ? null : value === 'true',
					})
				}
			/>

			<FormFiltersSelect<InvoiceDataTableFiltersType>
				labelText="Overdue"
				fieldName="is_overdue"
				fieldValue={
					filters.is_overdue.value === null
						? null
						: String(filters.is_overdue.value)
				}
				options={overdueOptions}
				onChange={(value) =>
					setFilterValues({
						is_overdue: value === null ? null : value === 'true',
					})
				}
			/>

			<FormFiltersDateRange<InvoiceDataTableFiltersType>
				labelText="Issue Date"
				start={{
					fieldName: 'issued_at_start',
					fieldValue: filters.issued_at_start.value,
					onSelect: (value) =>
						setFilterValues({
							issued_at_start: value,
						}),
				}}
				end={{
					fieldName: 'issued_at_end',
					fieldValue: filters.issued_at_end.value,
					onSelect: (value) =>
						setFilterValues({
							issued_at_end: value,
						}),
				}}
			/>

			<FormFiltersReset dataSource="invoice" />
		</div>
	);
};
