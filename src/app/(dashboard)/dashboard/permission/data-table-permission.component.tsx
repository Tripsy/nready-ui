'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersPermission } from '@/app/(dashboard)/dashboard/permission/data-table-filters-permission.component';

export const DataTablePermission = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="permission" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersPermission />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
