'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'log-history' },
] as const;

export function UsageGuideLogHistory() {
	return (
		<UsageGuide
			entity="log-history"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
