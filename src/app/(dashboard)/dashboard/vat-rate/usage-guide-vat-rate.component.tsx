'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'vat-rate' },
] as const;

export function UsageGuideVatRate() {
	return (
		<UsageGuide entity="vat-rate" stepCount={4} docsTabs={[...DOCS_TABS]} />
	);
}
