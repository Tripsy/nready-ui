'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'carrier' },
] as const;

export function UsageGuideCarrier() {
	return (
		<UsageGuide entity="carrier" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
