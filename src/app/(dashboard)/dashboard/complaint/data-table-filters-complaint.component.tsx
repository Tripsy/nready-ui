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
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSearchFilter } from '@/hooks/use-search-filter.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type ComplaintEntityType,
	ComplaintEntityTypeEnum,
	type ComplaintReason,
	ComplaintReasonEnum,
} from '@/models/complaint.model';
import { displayUserLabel, type UserModel } from '@/models/user.model';

const TRANSLATION_KEYS = [
	'complaint.field.entity_id',
	'complaint.field.entity_type',
	'complaint.field.is_resolved',
	'complaint.field.reason',
	'complaint.field.search',
	'complaint.field.user',
	'complaint.status.open',
	'complaint.status.resolved',
	...enumTranslationKeys(
		'complaint.enum.entity_type',
		ComplaintEntityTypeEnum,
	),
	...enumTranslationKeys('complaint.reason', ComplaintReasonEnum),
] as const;

export const DataTableFiltersComplaint = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const resolutionStates = useMemo(
		() =>
			// `is_resolved` is a boolean on the backend, so the select carries the two states as strings
			[
				{
					label: translations['complaint.status.open'],
					value: 'false',
				},
				{
					label: translations['complaint.status.resolved'],
					value: 'true',
				},
			],
		[translations],
	);

	const reasons = useMemo(
		() =>
			toOptionsFromEnum(ComplaintReasonEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'complaint.reason', value),
			}),
		[translations],
	);

	const entityTypes = useMemo(
		() =>
			toOptionsFromEnum(ComplaintEntityTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'complaint.enum.entity_type',
						value,
					),
			}),
		[translations],
	);

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

	// Matches the complaint's description - the backend's `term` filter, which
	// `data-table-list.component.tsx` renames `global` to on the way out.
	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValues({ global: value }),
	});

	// A single digit is a valid target id, so the debounce is the only thing keeping this
	// from firing per keystroke - there is no length to wait for.
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
				labelText={translations['complaint.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<ComplaintDataTableFiltersType>
				labelText={translations['complaint.field.is_resolved']}
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
				labelText={translations['complaint.field.reason']}
				fieldName="reason"
				fieldValue={filters.reason.value}
				options={reasons}
				onChange={(value) =>
					setFilterValue('reason', value as ComplaintReason)
				}
			/>

			<FormFiltersSelect<ComplaintDataTableFiltersType>
				labelText={translations['complaint.field.entity_type']}
				fieldName="entity_type"
				fieldValue={filters.entity_type.value}
				options={entityTypes}
				onChange={(value) =>
					setFilterValue('entity_type', value as ComplaintEntityType)
				}
			/>

			<FormFiltersSearch<ComplaintDataTableFiltersType>
				labelText={translations['complaint.field.entity_id']}
				fieldName="entity_id"
				search={searchEntityId}
			/>

			<FormFiltersAutoComplete<ComplaintDataTableFiltersType, UserModel>
				labelText={translations['complaint.field.user']}
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
