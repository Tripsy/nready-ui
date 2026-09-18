'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'brand' },
] as const;

export function UsageGuideBrand() {
	return (
		<UsageGuide entity="brand" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
