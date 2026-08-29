'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'address' },
] as const;

export function UsageGuideAddress() {
	return (
		<UsageGuide entity="address" stepCount={4} docsTabs={[...DOCS_TABS]} />
	);
}
