'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'stock-adjustment' },
] as const;

export function UsageGuideStockAdjustment() {
	return (
		<UsageGuide
			entity="stock-adjustment"
			stepCount={3}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
