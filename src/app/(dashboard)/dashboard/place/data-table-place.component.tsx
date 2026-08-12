'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersPlace } from '@/app/(dashboard)/dashboard/place/data-table-filters-place.component';

export const DataTablePlace = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="place" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersPlace />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
