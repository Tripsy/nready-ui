'use client';

import { type JSX, useMemo } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersReset,
	FormFiltersSearch,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { CartDataTableFiltersType } from '@/app/(dashboard)/dashboard/cart/cart.definition';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';

/**
 * The filter bar.
 *
 * **There is no search box.** The only free text a cart carries is its token, and that is the
 * guest's whole credential - offering it as a filter would make this screen a way to open any
 * cart. Everything below narrows by something the business already knows.
 *
 * No status and no "show deleted": a cart is a live basket or it does not exist, so there is no
 * state to filter by and nothing removed to bring back into the listing.
 */
export const DataTableFiltersCart = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'cart'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CartDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<CartDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	// A single digit is a valid id, so the debounce is the only thing keeping this from firing
	// per keystroke - there is no length to wait for.
	const searchUserId = useSearchFilter({
		initialValue: filters.user_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('user_id', value),
	});

	const searchCurrency = useSearchFilter({
		initialValue: filters.currency.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValue('currency', value.toUpperCase()),
	});

	const resetCallbacks = useMemo(
		() => [searchUserId.onReset, searchCurrency.onReset],
		[searchUserId.onReset, searchCurrency.onReset],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			{/* Guest carts name no user, so filtering by one returns members' carts only. */}
			<FormFiltersSearch<CartDataTableFiltersType>
				labelText="User ID"
				fieldName="user_id"
				search={searchUserId}
			/>

			<FormFiltersSearch<CartDataTableFiltersType>
				labelText="Currency"
				fieldName="currency"
				search={searchCurrency}
			/>

			<FormFiltersReset dataSource="cart" />
		</div>
	);
};
