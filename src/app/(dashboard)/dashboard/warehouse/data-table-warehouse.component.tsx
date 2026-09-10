'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersWarehouse } from '@/app/(dashboard)/dashboard/warehouse/data-table-filters-warehouse.component';

export const DataTableWarehouse = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="warehouse" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersWarehouse />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
