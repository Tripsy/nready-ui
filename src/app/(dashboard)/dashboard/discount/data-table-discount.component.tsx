'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersDiscount } from '@/app/(dashboard)/dashboard/discount/data-table-filters-discount.component';

export const DataTableDiscount = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="discount" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersDiscount />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
