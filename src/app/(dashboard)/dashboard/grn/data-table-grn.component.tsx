'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersGrn } from '@/app/(dashboard)/dashboard/grn/data-table-filters-grn.component';

export const DataTableGrn = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="grn" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersGrn />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
