'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'cash-flow' },
] as const;

export function UsageGuideCashFlow() {
	return (
		<UsageGuide
			entity="cash-flow"
			stepCount={6}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
