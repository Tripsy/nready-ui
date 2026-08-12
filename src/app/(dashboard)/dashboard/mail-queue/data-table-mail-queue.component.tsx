'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersMailQueue } from '@/app/(dashboard)/dashboard/mail-queue/data-table-filters-mail-queue.component';

export const DataTableMailQueue = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="mail-queue" selectionMode="multiple">
			<div className="table-container">
				<DataTableFiltersMailQueue />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
