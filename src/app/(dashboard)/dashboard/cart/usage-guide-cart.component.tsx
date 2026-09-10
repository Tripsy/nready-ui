'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

/*
 * Two documented route modules: `cart` is this read-only dashboard surface, `cart-public` the
 * storefront half under `/public/cart` - where carts are actually filled.
 */
const DOCS_TABS = [
	{ id: 'api', labelKey: 'tab_api', feature: 'cart' },
	{ id: 'public', labelKey: 'tab_public', feature: 'cart-public' },
] as const;

export function UsageGuideCart() {
	return <UsageGuide entity="cart" stepCount={5} docsTabs={[...DOCS_TABS]} />;
}
