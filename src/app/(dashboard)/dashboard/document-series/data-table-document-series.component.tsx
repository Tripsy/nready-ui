'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersDocumentSeries } from '@/app/(dashboard)/dashboard/document-series/data-table-filters-document-series.component';

export const DataTableDocumentSeries = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="document-series" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersDocumentSeries />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
