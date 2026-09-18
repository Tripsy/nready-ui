'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules, not one: `complaint` is the moderation API and
 * `complaint-public` the reader-facing half under `/public/complaints`, which files and amends
 * reports and is where every row in this list comes from.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'complaint' },
	{ id: 'public', labelKey: 'tab_public', feature: 'complaint-public' },
] as const;

export function UsageGuideComplaint() {
	return (
		<UsageGuide
			entity="complaint"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
