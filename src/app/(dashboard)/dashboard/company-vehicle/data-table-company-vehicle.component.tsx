'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCompanyVehicle } from '@/app/(dashboard)/dashboard/company-vehicle/data-table-filters-company-vehicle.component';

export const DataTableCompanyVehicle = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="company-vehicle" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCompanyVehicle />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
