'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'vendor' },
] as const;

export function UsageGuideVendor() {
	return (
		<UsageGuide entity="vendor" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
