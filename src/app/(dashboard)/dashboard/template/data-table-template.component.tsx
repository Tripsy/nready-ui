'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersTemplate } from '@/app/(dashboard)/dashboard/template/data-table-filters-template.component';

export const DataTableTemplate = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="template" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersTemplate />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
