'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCarrier } from '@/app/(dashboard)/dashboard/carrier/data-table-filters-carrier.component';

export const DataTableCarrier = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="carrier" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCarrier />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
