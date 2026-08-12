'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCmrVehicle } from '@/app/(dashboard)/dashboard/cmr-vehicle/data-table-filters-cmr-vehicle.component';

export const DataTableCmrVehicle = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="cmr-vehicle" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCmrVehicle />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
