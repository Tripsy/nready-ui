'use client';

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import { useStore } from 'zustand/react';
import { useDataTable } from '@/app/(dashboard)/_providers/data-table.provider';
import type { ClientLedgerDataTableFiltersType } from '@/app/(dashboard)/dashboard/client-ledger/client-ledger.definition';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Configuration } from '@/config/settings.config';
import { getResponseData } from '@/helpers/api.helper';
import { DisplayAmount } from '@/helpers/display.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { requestClientLedgerBalance } from '@/services/client-ledger.service';

const TRANSLATION_KEYS = [
	'client-ledger.balance.select_client',
	'client-ledger.balance.empty',
	'client-ledger.balance.received',
	'client-ledger.balance.refunded',
	'client-ledger.balance.net',
	'client-ledger.balance.net_base',
] as const;

/**
 * The selected client's balance, one card per currency, read from the same filter the listing
 * reads. Not narrowed by the other filters: the API answers the whole history, which is the figure
 * worth showing beside a filtered list.
 */
export const BalanceClientLedger = (): JSX.Element => {
	const { dataTableStore } = useDataTable<'client-ledger'>();

	const clientId = useStore(
		dataTableStore,
		(state) =>
			(state.tableState.filters as ClientLedgerDataTableFiltersType)
				.client_id.value,
	);

	const { translations, isTranslationLoading } =
		useTranslation(TRANSLATION_KEYS);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['client-ledger', 'balance', clientId],
		queryFn: async () => {
			const response = getResponseData(
				await requestClientLedgerBalance(Number(clientId)),
			);

			if (!response) {
				throw new Error('Could not retrieve client ledger balance');
			}

			return response.balances;
		},
		enabled: !!clientId,
		// The API does not cache it either - a stale balance is the one nobody should act on
		staleTime: 0,
	});

	if (isTranslationLoading) {
		return <Skeleton className="h-24 w-full" />;
	}

	if (!clientId) {
		return (
			<div className="text-muted text-sm py-4">
				{translations['client-ledger.balance.select_client']}
			</div>
		);
	}

	if (isLoading) {
		return <Skeleton className="h-24 w-full" />;
	}

	if (isError || !data) {
		return (
			<div className="text-danger text-sm py-4">
				Could not retrieve the client balance
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="text-muted text-sm py-4">
				{translations['client-ledger.balance.empty']}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
			{data.map((balance) => (
				<Card key={balance.currency}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted">
							{translations['client-ledger.balance.net']} -{' '}
							{balance.currency}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-1 text-sm">
						<div className="text-2xl font-bold">
							<DisplayAmount
								amount={balance.net}
								currencyCode={balance.currency}
							/>
						</div>
						<div className="flex justify-between">
							<span className="text-muted">
								{translations['client-ledger.balance.received']}
							</span>
							<DisplayAmount
								amount={balance.received}
								currencyCode={balance.currency}
							/>
						</div>
						<div className="flex justify-between">
							<span className="text-muted">
								{translations['client-ledger.balance.refunded']}
							</span>
							<DisplayAmount
								amount={balance.refunded}
								currencyCode={balance.currency}
							/>
						</div>
						{balance.currency !== Configuration.currency() && (
							<div className="flex justify-between">
								<span className="text-muted">
									{
										translations[
											'client-ledger.balance.net_base'
										]
									}
								</span>
								<DisplayAmount
									amount={balance.net_base}
									currencyCode={Configuration.currency()}
								/>
							</div>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	);
};
