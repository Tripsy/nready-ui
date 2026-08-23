'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersComplaint } from '@/app/(dashboard)/dashboard/complaint/data-table-filters-complaint.component';

export const DataTableComplaint = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="complaint" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersComplaint />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
