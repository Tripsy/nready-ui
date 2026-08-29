'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'user' },
] as const;

export function UsageGuideUser() {
	return <UsageGuide entity="user" stepCount={5} docsTabs={[...DOCS_TABS]} />;
}
