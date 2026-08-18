'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersRating } from '@/app/(dashboard)/dashboard/rating/data-table-filters-rating.component';

export const DataTableRating = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="rating" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersRating />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
