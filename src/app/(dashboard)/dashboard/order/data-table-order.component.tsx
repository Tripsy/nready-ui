'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersOrder } from '@/app/(dashboard)/dashboard/order/data-table-filters-order.component';

export const DataTableOrder = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="order" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersOrder />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
