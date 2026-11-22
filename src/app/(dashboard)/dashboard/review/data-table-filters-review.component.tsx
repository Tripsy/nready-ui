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
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { ReviewStatus } from '@/models/review.model';
import { ReviewStatusEnum } from '@/models/review.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';

const TRANSLATION_KEYS = [
	'review.field.is_pinned',
	'review.field.is_verified',
	'review.field.product_id',
	'review.field.rating_from',
	'review.field.search',
	'review.field.status',
	'review.field.user',
	'review.field.variant_id',
	'review.text.rating_exact',
	'review.text.rating_floor',
	'review.text.pinned',
	'review.text.not_pinned',
	'review.text.verified_buyer',
	'review.text.not_verified',
	...enumTranslationKeys('review.status', ReviewStatusEnum),
] as const;

export const DataTableFiltersReview = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const verifiedStates = useMemo(
		() => [
			{
				label: translations['review.text.verified_buyer'],
				value: 'true',
			},
			{ label: translations['review.text.not_verified'], value: 'false' },
		],
		[translations],
	);

	const pinnedStates = useMemo(
		() =>
			// Both flags are booleans on the backend, so the selects carry the two states as strings
			[
				{ label: translations['review.text.pinned'], value: 'true' },
				{
					label: translations['review.text.not_pinned'],
					value: 'false',
				},
			],
		[translations],
	);

	const ratingFloors = useMemo(
		() =>
			// The backend compares `rating_from` against the stored average with `>=`, so each
			// option is a floor rather than an exact score - "3 stars and up" is what the query does
			[
				{ label: translations['review.text.rating_exact'], value: '5' },
				...['4', '3', '2'].map((value) => ({
					label: replaceVars(
						translations['review.text.rating_floor'],
						{
							stars: value,
						},
					),
					value,
				})),
			],
		[translations],
	);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(ReviewStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'review.status', value),
			}),
		[translations],
	);

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
				labelText={translations['review.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText={translations['review.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as ReviewStatus)
				}
			/>

			<FormFiltersSearch<ReviewDataTableFiltersType>
				labelText={translations['review.field.product_id']}
				fieldName="product_id"
				search={searchProductId}
			/>

			{/* Reviews naming no variant drop out of the result, not only the ones naming
			    another - the filter asks for the reviews that speak about this variant. */}
			<FormFiltersSearch<ReviewDataTableFiltersType>
				labelText={translations['review.field.variant_id']}
				fieldName="variant_id"
				search={searchVariantId}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText={translations['review.field.rating_from']}
				fieldName="rating_from"
				fieldValue={filters.rating_from.value}
				options={ratingFloors}
				onChange={(value) => setFilterValue('rating_from', value)}
			/>

			<FormFiltersSelect<ReviewDataTableFiltersType>
				labelText={translations['review.field.is_pinned']}
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
				labelText={translations['review.field.is_verified']}
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
				labelText={translations['review.field.user']}
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
