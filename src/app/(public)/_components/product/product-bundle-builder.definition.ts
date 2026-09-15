/*
 * Kept out of `product-bundle-builder.component.tsx`: that module is `'use client'`, and a server
 * page importing a value from it receives a client reference rather than the array, so spreading
 * the keys into the page's batch throws at module evaluation.
 */
export const PRODUCT_BUNDLE_BUILDER_TRANSLATION_KEYS = [
	'text.bundle_heading',
	'text.bundle_included',
	'text.bundle_extras',
	'text.bundle_price',
	'text.bundle_free',
	'text.bundle_unavailable',
] as const;

export type ProductBundleBuilderTranslations = Record<
	(typeof PRODUCT_BUNDLE_BUILDER_TRANSLATION_KEYS)[number],
	string
>;
