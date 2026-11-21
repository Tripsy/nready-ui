'use client';

import type { JSX } from 'react';
import DataTableList from '@/app/(dashboard)/_components/data-table-list.component';
import { DataTableProvider } from '@/app/(dashboard)/_providers/data-table.provider';
import { useTranslation } from '@/hooks/use-translation.hook';

const TRANSLATION_KEYS = ['cost-over-floor.text.hint'] as const;

// A report with no row actions, so nothing to select
export const DataTableCostOverFloor = (): JSX.Element => {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<DataTableProvider dataSource="cost-over-floor" selectionMode={null}>
			<div className="table-container">
				<p className="border-b border-line pb-4 text-sm text-muted">
					{translations['cost-over-floor.text.hint']}
				</p>
				<DataTableList dataKey="id" />
			</div>
		</DataTableProvider>
	);
};
