'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCashFlow } from '@/app/(dashboard)/dashboard/cash-flow/data-table-filters-cash-flow.component';

export const DataTableCashFlow = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="cash-flow" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCashFlow />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
