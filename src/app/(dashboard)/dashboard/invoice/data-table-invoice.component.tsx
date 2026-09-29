'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersInvoice } from '@/app/(dashboard)/dashboard/invoice/data-table-filters-invoice.component';

export const DataTableInvoice = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="invoice" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersInvoice />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
