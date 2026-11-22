'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import {
	FormFiltersAutoComplete,
	FormFiltersDateRange,
	FormFiltersReset,
	FormFiltersSelect,
} from '@/app/(dashboard)/_components/form-filters.component';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { ClientLedgerDataTableFiltersType } from '@/app/(dashboard)/dashboard/client-ledger/client-ledger.definition';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestView } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useDataTableFilterReset } from '@/hooks/use-data-table-filter-reset.hook';
import { useSetFilterValues } from '@/hooks/use-set-filter-values.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	type ClientLedgerEntryType,
	ClientLedgerEntryTypeEnum,
} from '@/models/client-ledger.model';
import { type Currency, CurrencyEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'client-ledger.field.client',
	'client-ledger.field.currency',
	'client-ledger.field.entry_type',
	'client-ledger.field.occurred_at',
	...enumTranslationKeys(
		'client-ledger.enum.entry_type',
		ClientLedgerEntryTypeEnum,
	),
] as const;

// Currency codes, shown as they are
const currencies = toOptionsFromEnum(CurrencyEnum);

export const DataTableFiltersClientLedger = ({
	initialClientId,
}: {
	initialClientId: number | null;
}): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const entryTypes = useMemo(
		() =>
			toOptionsFromEnum(ClientLedgerEntryTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'client-ledger.enum.entry_type',
						value,
					),
			}),
		[translations],
	);

	const { dataSource, dataTableStateDefault, dataTableStore } =
		useDataTable<'client-ledger'>();

	const filters = useStore(
		dataTableStore,
		(state) => state.tableState.filters,
	) as ClientLedgerDataTableFiltersType;

	const updateTableState = useStore(
		dataTableStore,
		(state) => state.updateTableState,
	);

	const { setFilterValues } =
		useSetFilterValues<ClientLedgerDataTableFiltersType>(
			dataTableStore,
			updateTableState,
		);

	const [searchClient, setSearchClient] = useState(
		filters.client?.value ?? '',
	);

	const onResetClient = useCallback(() => {
		setSearchClient('');
	}, []);

	const resetCallbacks = useMemo(() => [onResetClient], [onResetClient]);

	const router = useRouter();
	const pathname = usePathname();

	/*
	 * A link from the client list names the client in the query. It replaces the whole filter set
	 * rather than just the client - the type, currency or dates left from another client's ledger
	 * would narrow this one for no reason - and goes back to the first page. The label is fetched
	 * because the autocomplete shows it; the id alone is what the listing needs, so a failed lookup
	 * still opens the ledger, under a placeholder label.
	 *
	 * The parameter is dropped from the URL once applied, so a reload or a later reset does not
	 * apply it again over what the user has since chosen.
	 */
	useEffect(() => {
		if (!initialClientId) {
			return;
		}

		let isActive = true;

		(async () => {
			const client = await requestView<ClientModel>(
				'client',
				initialClientId,
			).catch(() => undefined);

			if (!isActive) {
				return;
			}

			const label = client
				? displayClientLabel(client)
				: `#${initialClientId}`;
			const defaults =
				dataTableStateDefault.filters as ClientLedgerDataTableFiltersType;

			updateTableState({
				first: 0,
				filters: {
					...defaults,
					client: { ...defaults.client, value: label },
					client_id: {
						...defaults.client_id,
						value: initialClientId,
					},
				},
			});

			setSearchClient(label);
			router.replace(pathname);
		})();

		return () => {
			isActive = false;
		};
	}, [
		initialClientId,
		dataTableStateDefault.filters,
		updateTableState,
		router,
		pathname,
	]);

	useDataTableFilterReset({
		dataSource,
		defaultFilters: dataTableStateDefault.filters,
		updateTableState,
		onReset: resetCallbacks,
	});

	return (
		<div className="form-section flex-row flex-wrap gap-4 border-b border-line pb-4">
			<FormFiltersAutoComplete<
				ClientLedgerDataTableFiltersType,
				ClientModel
			>
				labelText={translations['client-ledger.field.client']}
				fieldName="client"
				fieldNameId="client_id"
				fieldValue={searchClient}
				className="pl-8"
				icons={{
					left: <Icons.Client className="opacity-40 h-4.5 w-4.5" />,
				}}
				setFilterValues={setFilterValues}
				setSearch={setSearchClient}
				dataSourceKey="client"
				getOptionLabel={(m) => displayClientLabel(m)}
				getOptionKey={(m) => m.id}
			/>

			<FormFiltersSelect<ClientLedgerDataTableFiltersType>
				labelText={translations['client-ledger.field.entry_type']}
				fieldName="entry_type"
				fieldValue={filters.entry_type.value}
				options={entryTypes}
				onChange={(value) =>
					setFilterValues({
						entry_type: value as ClientLedgerEntryType,
					})
				}
			/>

			<FormFiltersSelect<ClientLedgerDataTableFiltersType>
				labelText={translations['client-ledger.field.currency']}
				fieldName="currency"
				fieldValue={filters.currency.value}
				options={currencies}
				onChange={(value) =>
					setFilterValues({
						currency: value as Currency,
					})
				}
			/>

			<FormFiltersDateRange<ClientLedgerDataTableFiltersType>
				labelText={translations['client-ledger.field.occurred_at']}
				start={{
					fieldName: 'occurred_at_start',
					fieldValue: filters.occurred_at_start.value,
					onSelect: (value) =>
						setFilterValues({
							occurred_at_start: value,
						}),
				}}
				end={{
					fieldName: 'occurred_at_end',
					fieldValue: filters.occurred_at_end.value,
					onSelect: (value) =>
						setFilterValues({
							occurred_at_end: value,
						}),
				}}
			/>

			<FormFiltersReset dataSource="client-ledger" />
		</div>
	);
};
