'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersOrderReturn } from '@/app/(dashboard)/dashboard/order-return/data-table-filters-order-return.component';

export const DataTableOrderReturn = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="order-return" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersOrderReturn />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
