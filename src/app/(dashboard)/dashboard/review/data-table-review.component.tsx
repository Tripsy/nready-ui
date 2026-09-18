'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersReview } from '@/app/(dashboard)/dashboard/review/data-table-filters-review.component';

export const DataTableReview = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="review" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersReview />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
