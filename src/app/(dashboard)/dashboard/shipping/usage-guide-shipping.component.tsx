'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'shipping' },
] as const;

export function UsageGuideShipping() {
	return (
		<UsageGuide entity="shipping" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
