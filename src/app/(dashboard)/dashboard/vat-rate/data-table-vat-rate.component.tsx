'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersVatRate } from '@/app/(dashboard)/dashboard/vat-rate/data-table-filters-vat-rate.component';

export const DataTableVatRate = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="vat-rate" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersVatRate />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
