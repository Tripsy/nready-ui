'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'client-ledger' },
] as const;

export function UsageGuideClientLedger() {
	return (
		<UsageGuide
			entity="client-ledger"
			stepCount={4}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
