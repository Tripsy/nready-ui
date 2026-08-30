'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'template' },
] as const;

export function UsageGuideTemplate() {
	return (
		<UsageGuide entity="template" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
