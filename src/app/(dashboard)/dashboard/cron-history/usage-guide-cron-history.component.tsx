'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'cron-history' },
] as const;

export function UsageGuideCronHistory() {
	return (
		<UsageGuide
			entity="cron-history"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
