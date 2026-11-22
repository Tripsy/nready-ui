'use client';

import type { JSX } from 'react';
import { DataTableActions } from '@/app/(dashboard)/_components/data-table-actions.component';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { useTranslation } from '@/hooks/use-translation.hook';

const TRANSLATION_KEYS = ['low-stock.text.hint'] as const;

export const DataTableLowStock = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<DataTableProvider dataSource="low-stock" selectionMode="single">
			<div className="table-container">
				<p className="border-b border-line pb-4 text-sm text-muted">
					{translations['low-stock.text.hint']}
				</p>
				<DataTableActions />
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
