'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'warehouse' },
] as const;

export function UsageGuideWarehouse() {
	return (
		<UsageGuide
			entity="warehouse"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
