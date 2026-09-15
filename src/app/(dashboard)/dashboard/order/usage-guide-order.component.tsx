'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'order' },
] as const;

export function UsageGuideOrder() {
	return (
		<UsageGuide entity="order" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
