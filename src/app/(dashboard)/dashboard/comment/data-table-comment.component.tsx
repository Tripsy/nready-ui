'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersComment } from '@/app/(dashboard)/dashboard/comment/data-table-filters-comment.component';

export const DataTableComment = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="comment" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersComment />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
