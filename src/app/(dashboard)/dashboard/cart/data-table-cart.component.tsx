'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCart } from '@/app/(dashboard)/dashboard/cart/data-table-filters-cart.component';

export const DataTableCart = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="cart" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCart />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
