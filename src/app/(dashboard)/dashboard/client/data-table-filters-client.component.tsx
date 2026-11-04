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
import type { ClientDataTableFiltersType } from '@/app/(dashboard)/dashboard/client/client.definition';
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
	type ClientStatus,
	ClientStatusEnum,
	type ClientType,
	ClientTypeEnum,
} from '@/models/client.model';

const TRANSLATION_KEYS = [
	'client.field.client_type',
	'client.field.created_at',
	'client.field.search',
	'client.field.status',
	...enumTranslationKeys('client.status', ClientStatusEnum),
	...enumTranslationKeys('client.enum.type', ClientTypeEnum),
] as const;

export const DataTableFiltersClient = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const clientTypes = useMemo(
		() =>
			toOptionsFromEnum(ClientTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'client.enum.type', value),
			}),
		[translations],
	);

	const statuses = useMemo(
		() =>
			toOptionsFromEnum(ClientStatusEnum, {
				formatter: (value) =>
					translateEnumLabel(translations, 'client.status', value),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'client'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ClientDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValue } = useSetFilterValues<ClientDataTableFiltersType>(
		dataTableStore,
		updateTableState,
	);

	const searchGlobal = useSearchFilter({
		initialValue: filters.global.value ?? '',
		debounceDelay: 1000,
		minLength: 3,
		onSearch: (value) => setFilterValue('global', value),
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
			<FormFiltersSearch<ClientDataTableFiltersType>
				labelText={translations['client.field.search']}
				search={searchGlobal}
			/>

			<FormFiltersSelect<ClientDataTableFiltersType>
				labelText={translations['client.field.status']}
				fieldName="status"
				fieldValue={filters.status.value}
				options={statuses}
				onChange={(value) =>
					setFilterValue('status', value as ClientStatus)
				}
			/>

			<FormFiltersSelect<ClientDataTableFiltersType>
				labelText={translations['client.field.client_type']}
				fieldName="client_type"
				fieldValue={filters.client_type.value}
				options={clientTypes}
				onChange={(value) =>
					setFilterValue('client_type', value as ClientType)
				}
			/>

			<FormFiltersDateRange<ClientDataTableFiltersType>
				labelText={translations['client.field.created_at']}
				start={{
					fieldName: 'create_at_start',
					fieldValue: filters.create_at_start.value,
					onSelect: (value) =>
						setFilterValue('create_at_start', value),
				}}
				end={{
					fieldName: 'create_at_end',
					fieldValue: filters.create_at_end.value,
					onSelect: (value) => setFilterValue('create_at_end', value),
				}}
			/>

			<FormFiltersShowDeleted
				dataSource="client"
				checked={filters.is_deleted.value ?? false}
				onCheckedChange={(value) => setFilterValue('is_deleted', value)}
			/>

			<FormFiltersReset dataSource="client" />
		</div>
	);
};
