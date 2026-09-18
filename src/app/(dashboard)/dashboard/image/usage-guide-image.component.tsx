'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'image' },
] as const;

export function UsageGuideImage() {
	return (
		<UsageGuide entity="image" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
