'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'client' },
] as const;

export function UsageGuideClient() {
	return (
		<UsageGuide entity="client" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
