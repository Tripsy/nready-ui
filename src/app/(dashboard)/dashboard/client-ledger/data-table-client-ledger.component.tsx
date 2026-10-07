'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { BalanceClientLedger } from '@/app/(dashboard)/dashboard/client-ledger/balance-client-ledger.component';
import { DataTableFiltersClientLedger } from '@/app/(dashboard)/dashboard/client-ledger/data-table-filters-client-ledger.component';

/**
 * No selection: an entry is append-only and carries no action of its own - what there is to see
 * about it lives on the cash flow it links to.
 *
 * `initialClientId` is the client a link arrived with (`?client_id=`), which the filters adopt
 * over whatever client the persisted table state last held.
 */
export const DataTableClientLedger = ({
	initialClientId,
}: {
	initialClientId: number | null;
}): JSX.Element => {
	return (
		<DataTableProvider dataSource="client-ledger" selectionMode={null}>
			<div className="table-container">
				<DataTableFiltersClientLedger
					initialClientId={initialClientId}
				/>
				<BalanceClientLedger />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
