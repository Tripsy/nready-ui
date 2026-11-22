'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersWarehouseMovement } from '@/app/(dashboard)/dashboard/warehouse-movement/data-table-filters-warehouse-movement.component';

export const DataTableWarehouseMovement = (): JSX.Element => {
	return (
		<DataTableProvider
			dataSource="warehouse-movement"
			selectionMode="single"
		>
			<div className="table-container">
				<DataTableFiltersWarehouseMovement />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
