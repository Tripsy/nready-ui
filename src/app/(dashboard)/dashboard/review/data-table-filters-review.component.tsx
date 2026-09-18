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
import type { ReviewDataTableFiltersType } from '@/app/(dashboard)/dashboard/review/review.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import type { ReviewStatus } from '@/models/review.model';
import { ReviewStatusEnum } from '@/models/review.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';

const statuses = toOptionsFromEnum(ReviewStatusEnum, {
	formatter: formatEnumLabel,
});

/**
 * The backend compares `rating_from` against the stored average with `>=`, so each option is a
 * floor rather than an exact score - "3 stars and up" is the shape a reader recognizes, and it is
 * what the query actually does.
 */
const ratingFloors = [
	{ label: '5 stars', value: '5' },
	{ label: '4 stars and up', value: '4' },
	{ label: '3 stars and up', value: '3' },
	{ label: '2 stars and up', value: '2' },
];

/** Both flags are booleans on the backend, so the selects carry the two states as strings. */
const pinnedStates = [
	{ label: 'Pinned', value: 'true' },
	{ label: 'Not pinned', value: 'false' },
];

const verifiedStates = [
	{ label: 'Verified buyer', value: 'true' },
	{ label: 'Not verified', value: 'false' },
];

export const DataTableFiltersReview = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'review'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ReviewDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue, setFilterValues } =
		useSetFilterValues<ReviewDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	// Matches the review text - the backend's `term` filter, which
	// `data-table-list.component.tsx` renames `global` to on the way out.
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	// A single digit is a valid product id, so the debounce is the only thing keeping this
	// from firing per keystroke - there is no length to wait for.
	const searchProductId = useSearchFilter({
		initialValue: filters.product_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('product_id', value),
	});

	const searchVariantId = useSearchFilter({
		initialValue: filters.variant_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('variant_id', value),
	});

	const [searchUser, setSearchUser] = useState(filters.user?.value ?? '');

	const onResetUser = useCallback(() => {
		setSearchUser('');
	}, []);

	const resetCallbacks = useMemo(
		() => [
			searchGlobal.onReset,
			searchProductId.onReset,
			searchVariantId.onReset,
			onResetUser,
		],
		[
			searchGlobal.onReset,
			searchProductId.onReset,
			searchVariantId.onReset,
			onResetUser,
		],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<ReviewDataTableFiltersType>
				labelText="Review text"
				search={searchGlobal}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as ReviewStatus)
				}
			/>

			<FormFiltersSearch<ReviewDataTableFiltersType>
				labelText="Product ID"
				fieldName="product_id"
				search={searchProductId}
			/>

			{/* Reviews naming no variant drop out of the result, not only the ones naming
			    another - the filter asks for the reviews that speak about this variant. */}
			<FormFiltersSearch<ReviewDataTableFiltersType>
				labelText="Variant ID"
				fieldName="variant_id"
				search={searchVariantId}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText="Rating"
				fieldName="rating_from"
				fieldValue={filters.rating_from.value}
				options={ratingFloors}
				onChange={(value) => setFilterValue('rating_from', value)}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText="Pinned"
				fieldName="is_pinned"
				fieldValue={
					filters.is_pinned.value === null
						? null
						: String(filters.is_pinned.value)
				}
				options={pinnedStates}
				onChange={(value) =>
					setFilterValue('is_pinned', value === 'true')
				}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText="Verified"
				fieldName="is_verified"
				fieldValue={
					filters.is_verified.value === null
						? null
						: String(filters.is_verified.value)
				}
				options={verifiedStates}
				onChange={(value) =>
					setFilterValue('is_verified', value === 'true')
				}
			/>

			<FormFiltersAutoComplete<ReviewDataTableFiltersType, UserModel>
				labelText="Author"
				fieldName="user"
				fieldNameId="user_id"
				fieldValue={searchUser}
				className="pl-8"
				icons={{
					left: <Icons.User className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchUser}
				dataSourceKey="user"
				getOptionLabel={(m) => displayUserLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			{/* A withdrawn review is what `restore` acts on, so the list has to be able to show
			    one - the backend defaults this off and refuses it outright to a role that may
			    not see deleted rows. */}
			<FormFiltersShowDeleted
				dataSource="review"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="review" />
		</div>
	);
};
