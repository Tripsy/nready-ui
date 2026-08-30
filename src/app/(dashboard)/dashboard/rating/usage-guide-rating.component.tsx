'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules: `rating` is the dashboard API — read, delete and the listing —
 * and `rating-public` the reader-facing half under `/public/ratings`, which is where a rating is
 * actually cast and whose writes address a row by its target rather than by id.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'rating' },
	{ id: 'public', labelKey: 'tab_public', feature: 'rating-public' },
] as const;

export function UsageGuideRating() {
	return (
		<UsageGuide entity="rating" stepCount={5} docsTabs={[...DOCS_TABS]} />
	);
}
