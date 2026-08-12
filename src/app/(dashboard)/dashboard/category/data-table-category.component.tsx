'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCategory } from '@/app/(dashboard)/dashboard/category/data-table-filters-category.component';

export const DataTableCategory = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="category" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCategory />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
