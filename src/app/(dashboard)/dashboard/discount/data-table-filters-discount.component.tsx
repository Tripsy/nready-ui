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
import type { DiscountDataTableFiltersType } from '@/app/(dashboard)/dashboard/discount/discount.definition';
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
	type DiscountReason,
	DiscountReasonEnum,
	type DiscountScope,
	DiscountScopeEnum,
	type DiscountType,
	DiscountTypeEnum,
} from '@/models/discount.model';

const TRANSLATION_KEYS = [
	'discount.field.reason',
	'discount.field.scope',
	'discount.field.search',
	'discount.field.start_date',
	'discount.field.type',
	...enumTranslationKeys('discount.enum.scope', DiscountScopeEnum),
	...enumTranslationKeys('discount.enum.reason', DiscountReasonEnum),
	...enumTranslationKeys('discount.enum.type', DiscountTypeEnum),
] as const;

export const DataTableFiltersDiscount = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const types = useMemo(
		() =>
			toOptionsFromEnum(DiscountTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'discount.enum.type',
						value,
					),
			}),
		[translations],
	);

	const reasons = useMemo(
		() =>
			toOptionsFromEnum(DiscountReasonEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'discount.enum.reason',
						value,
					),
			}),
		[translations],
	);

	const scopes = useMemo(
		() =>
			toOptionsFromEnum(DiscountScopeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'discount.enum.scope',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'discount'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as DiscountDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<DiscountDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	// The backend matches the term against `id` when numeric, else `label` / `reference`
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
			<FormFiltersSearch<DiscountDataTableFiltersType>
				labelText={translations['discount.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<DiscountDataTableFiltersType>
				labelText={translations['discount.field.scope']}
				className="w-28"
				fieldName="scope"
				fieldValue={filters.scope.value}
				options={scopes}
				onChange={(value) =>
					setFilterValues({ scope: value as DiscountScope })
				}
			/>

			<FormFiltersSelect<DiscountDataTableFiltersType>
				labelText={translations['discount.field.reason']}
				className="w-48"
				fieldName="reason"
				fieldValue={filters.reason.value}
				options={reasons}
				onChange={(value) =>
					setFilterValues({ reason: value as DiscountReason })
				}
			/>

			<FormFiltersSelect<DiscountDataTableFiltersType>
				labelText={translations['discount.field.type']}
				className="w-24"
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValues({ type: value as DiscountType })
				}
			/>

			<FormFiltersDateRange<DiscountDataTableFiltersType>
				labelText={translations['discount.field.start_date']}
				start={{
					fieldName: 'start_at_start',
					fieldValue: filters.start_at_start.value,
					onSelect: (value) =>
						setFilterValues({ start_at_start: value }),
				}}
				end={{
					fieldName: 'start_at_end',
					fieldValue: filters.start_at_end.value,
					onSelect: (value) =>
						setFilterValues({ start_at_end: value }),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="discount"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="discount" />
		</div>
	);
};
