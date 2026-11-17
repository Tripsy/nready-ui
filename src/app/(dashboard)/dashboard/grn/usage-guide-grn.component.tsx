'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [{ id: 'api', labelKey: 'tab_api', feature: 'grn' }] as const;

export function UsageGuideGrn() {
	return <UsageGuide entity="grn" stepCount={5} docsTabs={[...DOCS_TABS]} />;
}
