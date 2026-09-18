'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'exchange-rate' },
] as const;

export function UsageGuideExchangeRate() {
	return (
		<UsageGuide
			entity="exchange-rate"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
