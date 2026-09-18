'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'term' },
] as const;

export function UsageGuideTerm() {
	return <UsageGuide entity="term" stepCount={5} docsTabs={[...DOCS_TABS]} />;
}
