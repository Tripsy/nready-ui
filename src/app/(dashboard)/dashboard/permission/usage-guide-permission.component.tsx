'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'permission' },
] as const;

export function UsageGuidePermission() {
	return (
		<UsageGuide
			entity="permission"
			stepCount={5}
			docsTabs={[...DOCS_TABS]}
		/>
	);
}
