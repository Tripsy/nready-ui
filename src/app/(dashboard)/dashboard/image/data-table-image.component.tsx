'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersImage } from '@/app/(dashboard)/dashboard/image/data-table-filters-image.component';

export const DataTableImage = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="image" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersImage />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
