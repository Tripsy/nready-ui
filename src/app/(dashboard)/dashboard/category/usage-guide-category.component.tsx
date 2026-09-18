'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules, not one: `category` is the dashboard API and `category-public`
 * the visitor-facing half under `/public/categories`, which has its own controller, no bearer
 * token and a listing pinned to the active tree.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'category' },
	{ id: 'public', labelKey: 'tab_public', feature: 'category-public' },
] as const;

export function UsageGuideCategory() {
	return (
		<UsageGuide entity="category" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
