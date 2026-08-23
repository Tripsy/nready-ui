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
import type { ComplaintDataTableFiltersType } from '@/app/(dashboard)/dashboard/complaint/complaint.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import {
	type ComplaintEntityType,
	ComplaintEntityTypeEnum,
	type ComplaintReason,
	ComplaintReasonEnum,
} from '@/models/complaint.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';

const entityTypes = toOptionsFromEnum(ComplaintEntityTypeEnum, {
	formatter: formatEnumLabel,
});

const reasons = toOptionsFromEnum(ComplaintReasonEnum, {
	formatter: formatEnumLabel,
});

/** `is_resolved` is a boolean on the backend, so the select carries the two states as strings. */
const resolutionStates = [
	{ label: 'Open', value: 'false' },
	{ label: 'Resolved', value: 'true' },
];

export const DataTableFiltersComplaint = (): JSX.Element => {
	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'complaint'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ComplaintDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue, setFilterValues } =
		useSetFilterValues<ComplaintDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	// Matches the complaint's description — the backend's `term` filter, which
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

	const [searchUser, setSearchUser] = useState(filters.user?.value ?? '');

	const onResetUser = useCallback(() => {
		setSearchUser('');
	}, []);

	const resetCallbacks = useMemo(
		() => [searchGlobal.onReset, searchEntityId.onReset, onResetUser],
		[searchGlobal.onReset, searchEntityId.onReset, onResetUser],
	);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersSearch<ComplaintDataTableFiltersType>
				labelText="Description"
				search={searchGlobal}
			/>

			<FormFiltersSelect<ComplaintDataTableFiltersType>
				labelText="Resolution"
				fieldName="is_resolved"
				fieldValue={
					filters.is_resolved.value === null
						? null
						: String(filters.is_resolved.value)
				}
				options={resolutionStates}
				onChange={(value) =>
					setFilterValue('is_resolved', value === 'true')
				}
			/>

			<FormFiltersSelect<ComplaintDataTableFiltersType>
				labelText="Reason"
				fieldName="reason"
				fieldValue={filters.reason.value}
				options={reasons}
				onChange={(value) =>
					setFilterValue('reason', value as ComplaintReason)
				}
			/>

			<FormFiltersSelect<ComplaintDataTableFiltersType>
				labelText="Target"
				fieldName="entity_type"
				fieldValue={filters.entity_type.value}
				options={entityTypes}
				onChange={(value) =>
					setFilterValue('entity_type', value as ComplaintEntityType)
				}
			/>

			<FormFiltersSearch<ComplaintDataTableFiltersType>
				labelText="Target ID"
				fieldName="entity_id"
				search={searchEntityId}
			/>

			<FormFiltersAutoComplete<ComplaintDataTableFiltersType, UserModel>
				labelText="Reporter"
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

			<FormFiltersShowDeleted
				dataSource="complaint"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) =>
					setFilterValues({ is_deleted: value })
				}
			/>

			<FormFiltersReset dataSource="complaint" />
		</div>
	);
};
