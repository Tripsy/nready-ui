'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersLogHistory } from '@/app/(dashboard)/dashboard/log-history/data-table-filters-log-history.component';

export const DataTableLogHistory = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="log-history" selectionMode="multiple">
			<div className="table-container">
				<DataTableFiltersLogHistory />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
