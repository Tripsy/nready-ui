'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * The feature folder ships two route modules — `product` (this dashboard) and `product-public`
 * (the anonymous catalog surface) — so the guide offers a tab for each. Both only fetch once
 * their own tab is opened.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'product' },
	{ id: 'public', labelKey: 'tab_public', feature: 'product-public' },
] as const;

export function UsageGuideProduct() {
	return (
		<UsageGuide entity="product" stepCount={6} docsTabs={[...DOCS_TABS]} />
	);
}
