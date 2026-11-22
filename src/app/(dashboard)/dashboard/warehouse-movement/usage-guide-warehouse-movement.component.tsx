'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'warehouse-movement' },
] as const;

export function UsageGuideWarehouseMovement() {
	return (
		<UsageGuide
			entity="warehouse-movement"
			stepCount={4}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
