'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersLogData } from '@/app/(dashboard)/dashboard/log-data/data-table-filters-log-data.component';

export const DataTableLogData = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="log-data" selectionMode="multiple">
			<div className="table-container">
				<DataTableFiltersLogData />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
