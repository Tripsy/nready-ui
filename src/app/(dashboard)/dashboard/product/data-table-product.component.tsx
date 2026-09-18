'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersProduct } from '@/app/(dashboard)/dashboard/product/data-table-filters-product.component';

export const DataTableProduct = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="product" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersProduct />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
