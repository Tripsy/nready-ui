'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'log-data' },
] as const;

export function UsageGuideLogData() {
	return (
		<UsageGuide entity="log-data" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
