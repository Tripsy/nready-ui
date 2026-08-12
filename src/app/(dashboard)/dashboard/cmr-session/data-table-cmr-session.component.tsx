'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersCmrSession } from '@/app/(dashboard)/dashboard/cmr-session/data-table-filters-cmr-session.component';

export const DataTableCmrSession = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="cmr-session" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersCmrSession />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
