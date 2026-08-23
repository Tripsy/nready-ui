'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersReset,
	FormFiltersSearch,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { RatingDataTableFiltersType } from '@/app/(dashboard)/dashboard/rating/rating.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type RatingEmoji,
	RatingEmojiEnum,
	type RatingEntityType,
	RatingEntityTypeEnum,
	type RatingType,
	RatingTypeEnum,
} from '@/models/rating.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';

const entityTypes = toOptionsFromEnum(RatingEntityTypeEnum, {
	formatter: formatEnumLabel,
});

const types = toOptionsFromEnum(RatingTypeEnum, {
	formatter: formatEnumLabel,
});

const reactions = toOptionsFromEnum(RatingEmojiEnum, {
	formatter: formatEnumLabel,
});

export const DataTableFiltersRating = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'rating'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as RatingDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue, setFilterValues } =
		useSetFilterValues<RatingDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	// A single digit is a valid target id, so the debounce is the only thing keeping this
	// from firing per keystroke — there is no length to wait for.
	const searchEntityId = useSearchFilter({
		initialValue: filters.entity_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('entity_id', value),
	});

	const [searchUser, setSearchUser] = useState(filters.user?.value ?? '');

	const onResetUser = useCallback(() => {
		setSearchUser('');
	}, []);

	const resetCallbacks = useMemo(
		() => [searchEntityId.onReset, onResetUser],
		[searchEntityId.onReset, onResetUser],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSelect<RatingDataTableFiltersType>
				labelText="Target"
				fieldName="entity_type"
				fieldValue={filters.entity_type.value}
				options={entityTypes}
				onChange={(value) =>
					setFilterValue('entity_type', value as RatingEntityType)
				}
			/>

			<FormFiltersSearch<RatingDataTableFiltersType>
				labelText="Target ID"
				fieldName="entity_id"
				search={searchEntityId}
			/>

			<FormFiltersSelect<RatingDataTableFiltersType>
				labelText="Type"
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValue('type', value as RatingType)
				}
			/>

			{/* Only emoji rows carry a reaction, so this narrows to those whatever `type` holds. */}
			<FormFiltersSelect<RatingDataTableFiltersType>
				labelText="Reaction"
				fieldName="reaction"
				fieldValue={filters.reaction.value}
				options={reactions}
				onChange={(value) =>
					setFilterValue('reaction', value as RatingEmoji)
				}
			/>

			<FormFiltersAutoComplete<RatingDataTableFiltersType, UserModel>
				labelText="Rated By"
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

			<FormFiltersReset dataSource="rating" />
		</div>
	);
};
