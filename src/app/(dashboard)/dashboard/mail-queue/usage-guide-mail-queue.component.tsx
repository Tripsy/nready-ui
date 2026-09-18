'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'mail-queue' },
] as const;

export function UsageGuideMailQueue() {
	return (
		<UsageGuide
			entity="mail-queue"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
