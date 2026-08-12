'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersWorkSession } from '@/app/(dashboard)/dashboard/work-session/data-table-filters-work-session.component';

export const DataTableWorkSession = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="work-session" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersWorkSession />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
