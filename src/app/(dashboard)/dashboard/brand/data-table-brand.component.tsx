'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersBrand } from '@/app/(dashboard)/dashboard/brand/data-table-filters-brand.component';

export const DataTableBrand = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="brand" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersBrand />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
