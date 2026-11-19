'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
	FormFiltersShowDeleted,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { OrderReturnDataTableFiltersType } from '@/app/(dashboard)/dashboard/order-return/order-return.definition';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type OrderReturnReason,
	OrderReturnReasonEnum,
	type OrderReturnStatus,
	OrderReturnStatusEnum,
} from '@/models/order-return.model';

const TRANSLATION_KEYS = [
	'order-return.field.search',
	'order-return.field.status',
	'order-return.field.reason',
	'order-return.field.created_at',
	...enumTranslationKeys('order-return.status', OrderReturnStatusEnum),
	...enumTranslationKeys('order-return.enum.reason', OrderReturnReasonEnum),
] as const;

export const DataTableFiltersOrderReturn = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(OrderReturnStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'order-return.status',
						value,
					),
			}),
		[translations],
	);

	const reasons = useMemo(
		() =>
			toOptionsFromEnum(OrderReturnReasonEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'order-return.enum.reason',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'order-return'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as OrderReturnDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<OrderReturnDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	/*
	 * The backend reads an all-digit term as the return number or id, and a written reference
	 * (`RMA-7`) as series plus number. Nothing else on a return is searchable.
	 */
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
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
			<FormFiltersSearch<OrderReturnDataTableFiltersType>
				labelText={translations['order-return.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<OrderReturnDataTableFiltersType>
				labelText={translations['order-return.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValues({ status: value as OrderReturnStatus })
				}
			/>

			<FormFiltersSelect<OrderReturnDataTableFiltersType>
				labelText={translations['order-return.field.reason']}
				fieldName="reason"
				fieldValue={filters.reason.value}
				options={reasons}
				onChange={(value) =>
					setFilterValues({ reason: value as OrderReturnReason })
				}
			/>

			<FormFiltersDateRange<OrderReturnDataTableFiltersType>
				labelText={translations['order-return.field.created_at']}
				start={{
					fieldName: 'create_date_start',
					fieldValue: filters.create_date_start.value,
					onSelect: (value) =>
						setFilterValues({ create_date_start: value }),
				}}
				end={{
					fieldName: 'create_date_end',
					fieldValue: filters.create_date_end.value,
					onSelect: (value) =>
						setFilterValues({ create_date_end: value }),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="order-return"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="order-return" />
		</div>
	);
};
