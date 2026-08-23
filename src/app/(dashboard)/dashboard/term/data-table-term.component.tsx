'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersTerm } from '@/app/(dashboard)/dashboard/term/data-table-filters-term.component';

export const DataTableTerm = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="term" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersTerm />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
