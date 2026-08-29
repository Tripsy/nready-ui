'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules, not one: `article` is the dashboard API and `article-public`
 * the visitor-facing half under `/public/articles`, which has its own controller, no bearer
 * token and a deliberately narrower filter set.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'article' },
	{ id: 'public', labelKey: 'tab_public', feature: 'article-public' },
] as const;

export function UsageGuideArticle() {
	return (
		<UsageGuide entity="article" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
