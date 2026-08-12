'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersWorkSessionVehicle } from '@/app/(dashboard)/dashboard/work-session-vehicle/data-table-filters-work-session-vehicle.component';

export const DataTableWorkSessionVehicle = (): JSX.Element => {
	return (
		<DataTableProvider
			dataSource="work-session-vehicle"
			selectionMode="single"
		>
			<div className="table-container">
				<DataTableFiltersWorkSessionVehicle />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
