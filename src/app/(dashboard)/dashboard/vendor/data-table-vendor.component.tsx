'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersVendor } from '@/app/(dashboard)/dashboard/vendor/data-table-filters-vendor.component';

export const DataTableVendor = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="vendor" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersVendor />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
