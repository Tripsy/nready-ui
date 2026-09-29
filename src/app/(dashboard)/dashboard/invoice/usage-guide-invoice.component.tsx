'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'invoice' },
] as const;

export function UsageGuideInvoice() {
	return (
		<UsageGuide entity="invoice" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
