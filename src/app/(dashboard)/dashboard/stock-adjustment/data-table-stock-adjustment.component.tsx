'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersStockAdjustment } from '@/app/(dashboard)/dashboard/stock-adjustment/data-table-filters-stock-adjustment.component';

export const DataTableStockAdjustment = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="stock-adjustment" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersStockAdjustment />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
