'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules, not one: `template` is the dashboard API and `template-public`
 * the visitor-facing half under `/public/pages`, which has its own controller, no bearer token
 * and reaches page templates only.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'template' },
	{ id: 'public', labelKey: 'tab_public', feature: 'template-public' },
] as const;

export function UsageGuideTemplate() {
	return (
		<UsageGuide entity="template" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
