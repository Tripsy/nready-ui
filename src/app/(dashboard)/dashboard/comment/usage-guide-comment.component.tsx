'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Three documented route modules: `comment` is the moderation API, `comment-public` the
 * reader-facing half under `/public/comments`, and `comment-subscription-public` the unsubscribe
 * landing page's own endpoints, which are addressed by token rather than by id.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'comment' },
	{ id: 'public', labelKey: 'tab_public', feature: 'comment-public' },
	{
		id: 'subscription',
		labelKey: 'tab_subscription',
		feature: 'comment-subscription-public',
	},
] as const;

export function UsageGuideComment() {
	return (
		<UsageGuide entity="comment" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
