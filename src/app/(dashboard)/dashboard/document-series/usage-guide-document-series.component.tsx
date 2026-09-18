'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'document-series' },
] as const;

export function UsageGuideDocumentSeries() {
	return (
		<UsageGuide
			entity="document-series"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
