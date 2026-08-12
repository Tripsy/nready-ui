'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCmr } from '@/app/(dashboard)/dashboard/cmr/data-table-filters-cmr.component';

export const DataTableCmr = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="cmr" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCmr />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
