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
import type { CommentDataTableFiltersType } from '@/app/(dashboard)/dashboard/comment/comment.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type CommentEntityType,
	CommentEntityTypeEnum,
	type CommentStatus,
	CommentStatusEnum,
	type CommentType,
	CommentTypeEnum,
} from '@/models/comment.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';

const entityTypes = toOptionsFromEnum(CommentEntityTypeEnum, {
	formatter: formatEnumLabel,
});

const types = toOptionsFromEnum(CommentTypeEnum, {
	formatter: formatEnumLabel,
});

const statuses = toOptionsFromEnum(CommentStatusEnum, {
	formatter: formatEnumLabel,
});

/** `is_pinned` is a boolean on the backend, so the select carries the two states as strings. */
const pinnedStates = [
	{ label: 'Pinned', value: 'true' },
	{ label: 'Not pinned', value: 'false' },
];

export const DataTableFiltersComment = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'comment'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as CommentDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue, setFilterValues } =
		useSetFilterValues<CommentDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	// Matches the comment body and a guest's name — the backend's `term` filter, which
	// `data-table-list.component.tsx` renames `global` to on the way out.
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	// A single digit is a valid target id, so the debounce is the only thing keeping this
	// from firing per keystroke — there is no length to wait for.
	const searchEntityId = useSearchFilter({
		initialValue: filters.entity_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('entity_id', value),
	});

	const searchParentId = useSearchFilter({
		initialValue: filters.parent_id.value ?? '',
		debounceDelay: 1000,
		minLength: 1,
		onSearch: (value) => setFilterValue('parent_id', value),
	});

	const [searchUser, setSearchUser] = useState(filters.user?.value ?? '');

	const onResetUser = useCallback(() => {
		setSearchUser('');
	}, []);

	const resetCallbacks = useMemo(
		() => [
			searchGlobal.onReset,
			searchEntityId.onReset,
			searchParentId.onReset,
			onResetUser,
		],
		[
			searchGlobal.onReset,
			searchEntityId.onReset,
			searchParentId.onReset,
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
			<FormFiltersSearch<CommentDataTableFiltersType>
				labelText="Content / Guest"
				search={searchGlobal}
			/>

			<FormFiltersSelect<CommentDataTableFiltersType>
				labelText="Status"
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as CommentStatus)
				}
			/>

			<FormFiltersSelect<CommentDataTableFiltersType>
				labelText="Target"
				fieldName="entity_type"
				fieldValue={filters.entity_type.value}
				options={entityTypes}
				onChange={(value) =>
					setFilterValue('entity_type', value as CommentEntityType)
				}
			/>

			<FormFiltersSearch<CommentDataTableFiltersType>
				labelText="Target ID"
				fieldName="entity_id"
				search={searchEntityId}
			/>

			<FormFiltersSelect<CommentDataTableFiltersType>
				labelText="Type"
				fieldName="type"
				fieldValue={filters.type.value}
				options={types}
				onChange={(value) =>
					setFilterValue('type', value as CommentType)
				}
			/>

			{/* The comment this one replies to; a root has none, so this narrows to one thread. */}
			<FormFiltersSearch<CommentDataTableFiltersType>
				labelText="Reply To"
				fieldName="parent_id"
				search={searchParentId}
			/>

			<FormFiltersSelect<CommentDataTableFiltersType>
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

			<FormFiltersAutoComplete<CommentDataTableFiltersType, UserModel>
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

			<FormFiltersReset dataSource="comment" />
		</div>
	);
};
