'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersVehicle } from '@/app/(dashboard)/dashboard/vehicle/data-table-filters-vehicle.component';

export const DataTableVehicle = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="vehicle" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersVehicle />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
