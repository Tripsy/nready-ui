'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'place' },
] as const;

export function UsageGuidePlace() {
	return (
		<UsageGuide entity="place" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
