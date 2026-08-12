'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersAddress } from '@/app/(dashboard)/dashboard/address/data-table-filters-address.component';

export const DataTableAddress = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="address" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersAddress />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
