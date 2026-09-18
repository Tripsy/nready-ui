'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { DataTableFiltersExchangeRate } from '@/app/(dashboard)/dashboard/exchange-rate/data-table-filters-exchange-rate.component';

export const DataTableExchangeRate = (): JSX.Element => {
	return (
		<DataTableProvider dataSource="exchange-rate" selectionMode="single">
			<div className="table-container">
				<DataTableFiltersExchangeRate />
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
