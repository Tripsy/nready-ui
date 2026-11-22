'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'order-return' },
	{ id: 'public', labelKey: 'tab_public', feature: 'order-return-public' },
] as const;

export function UsageGuideOrderReturn() {
	return (
		<UsageGuide
			entity="order-return"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
