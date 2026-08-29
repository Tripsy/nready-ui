'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'discount' },
] as const;

export function UsageGuideDiscount() {
	return (
		<UsageGuide entity="discount" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
