'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersShipping } from '@/app/(dashboard)/dashboard/shipping/data-table-filters-shipping.component';

export const DataTableShipping = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="shipping" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersShipping />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
