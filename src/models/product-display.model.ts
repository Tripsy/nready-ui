/**
 * How the catalog grid treats a product's variants.
 *
 * Its own module rather than a corner of `product.model.ts`: the value is read from
 * `settings.config.ts`, and `product.model.ts` imports that same config - putting the enum
 * there would close a cycle, which `pnpm run biome` fails on.
 */
export const ProductVariantDisplayEnum = {
	/** One card per product, priced from its variants. */
	COLLAPSED: 'collapsed',
	/** One card per variant, named from its axis values. */
	EXPANDED: 'expanded',
} as const;

export type ProductVariantDisplay =
	(typeof ProductVariantDisplayEnum)[keyof typeof ProductVariantDisplayEnum];
