'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersArticle } from '@/app/(dashboard)/dashboard/article/data-table-filters-article.component';

export const DataTableArticle = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="article" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersArticle />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
