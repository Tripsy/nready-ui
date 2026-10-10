/*
 * Kept out of `product-options-builder.component.tsx` for the reason the bundle builder's keys are:
 * that module is `'use client'`, and a server page importing a value from it receives a client
 * reference rather than the array.
 */
export const PRODUCT_OPTIONS_BUILDER_TRANSLATION_KEYS = [
	'text.options_optional',
	'text.options_choose_exactly',
	'text.options_choose_at_least',
	'text.options_choose_at_most',
	'text.options_choose_between',
	'text.options_price',
] as const;

export type ProductOptionsBuilderTranslations = Record<
	(typeof PRODUCT_OPTIONS_BUILDER_TRANSLATION_KEYS)[number],
	string
>;
