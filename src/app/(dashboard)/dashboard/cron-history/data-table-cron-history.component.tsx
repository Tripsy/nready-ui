'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCronHistory } from '@/app/(dashboard)/dashboard/cron-history/data-table-filters-cron-history.component';

export const DataTableCronHistory = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="cron-history" selectionMode="multiple">
			<div className="table-container">
				<DataTableFiltersCronHistory />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
