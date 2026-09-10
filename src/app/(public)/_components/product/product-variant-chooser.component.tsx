import Link from 'next/link';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';
import type { ProductVariantAxisGroupType } from '@/models/product.model';

export const PRODUCT_VARIANT_CHOOSER_TRANSLATION_KEYS = [
	'text.variant_adjusts',
] as const;

export type ProductVariantChooserTranslations = Record<
	(typeof PRODUCT_VARIANT_CHOOSER_TRANSLATION_KEYS)[number],
	string
>;

/**
 * How many variants it takes before the grid is worth folding into axes.
 *
 * Under it the whole set fits on one line and reads as what it is - two sizes, or a pizza in 25
 * and 32 cm - so a row per axis would be a heading and a label around a choice the visitor had
 * already made. From three up the combinations start multiplying, and a shirt in four sizes and
 * five colors is twenty links nobody reads to the end of.
 *
 * Not the only condition - the page also keeps a single-axis set flat, however long it runs,
 * because there the flat list prices every entry and the fold cannot.
 */
export const VARIANT_CHOOSER_MIN_VARIANTS = 3;

/**
 * The variant chooser, one row per axis: size on one line, color on the next, rather than every
 * combination the two multiply out to.
 *
 * Links rather than a control, exactly like the flat list it replaces: a variant has no page of
 * its own, so the SKU rides in the query string and the product URL stays canonical. That also
 * keeps this a server component, so a crawler still reaches every variant - through as many
 * clicks as there are axes rather than one, which is the trade the fold makes.
 *
 * A choice the current selection cannot keep - a color this size does not come in - still links,
 * to the closest variant carrying it, and says so. Hiding it would leave the visitor unable to
 * tell a color the catalog does not stock from one this size happens not to come in; disabling
 * it would be the same silence with a cursor.
 */
export function ProductVariantChooser({
	groups,
	slug,
	translations,
}: {
	groups: ProductVariantAxisGroupType[];
	slug: string;
	translations: ProductVariantChooserTranslations;
}) {
	return (
		<div className="mt-6 flex flex-col gap-4">
			{groups.map((group) => (
				<div key={group.label_id}>
					<h2 className="text-xs uppercase tracking-wide text-muted">
						{group.label}
					</h2>

					<ul className="mt-2 flex flex-wrap gap-2">
						{group.choices.map((choice) => (
							<li key={choice.key}>
								<Link
									href={`${Routes.get('product-view', { slug })}?variant=${encodeURIComponent(choice.sku)}`}
									aria-current={
										choice.is_selected ? 'true' : undefined
									}
									title={
										choice.is_exact
											? undefined
											: translations[
													'text.variant_adjusts'
												]
									}
									className={cn(
										'block rounded-2xl border px-4 py-2 text-sm font-medium transition-colors',
										choice.is_selected
											? 'border-accent bg-accent-soft text-accent-soft-foreground'
											: 'border-border hover:border-accent',
										/*
										 * Dimmed rather than removed: the value is on offer, just
										 * not beside the rest of what is currently chosen.
										 */
										!choice.is_exact &&
											!choice.is_selected &&
											'border-dashed text-muted',
									)}
								>
									{choice.label}
								</Link>
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}
