'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersUser } from '@/app/(dashboard)/dashboard/user/data-table-filters-user.component';

export const DataTableUser = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="user" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersUser />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
