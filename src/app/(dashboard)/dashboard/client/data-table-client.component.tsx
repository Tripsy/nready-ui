'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersClient } from '@/app/(dashboard)/dashboard/client/data-table-filters-client.component';

export const DataTableClient = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="client" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersClient />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
