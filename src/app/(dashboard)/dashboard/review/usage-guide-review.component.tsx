'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules: `review` is the moderation API, `review-public` the storefront
 * half under `/public/reviews` - where the reviews are actually written.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'review' },
	{ id: 'public', labelKey: 'tab_public', feature: 'review-public' },
] as const;

export function UsageGuideReview() {
	return (
		<UsageGuide entity="review" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
