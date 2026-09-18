import type { BadgeVariant } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { capitalizeFirstLetter } from '@/helpers/string.helper';
import type { ProductRefType } from '@/models/product.model';

/**
 * The tones a tag may take, in a fixed order.
 *
 * Muted throughout: a tag describes the product, it does not warn about it, and the solid halves
 * of this palette carry meanings ("danger", "success") a merchandising label has no business
 * borrowing. What the colors do here is tell one tag from the next.
 */
const TAG_TONES: BadgeVariant[] = [
	'softAccent',
	'softSuccess',
	'softWarning',
	'softDanger',
	'softDefault',
];

/**
 * Which tone a tag takes - decided by its id, so "best seller" is the same color on every product
 * carrying it, and a reader who has seen the tag once recognizes it on the next page.
 *
 * The alternative, coloring by position in this product's own list, would give the same tag a
 * different color on every product it appears on, which is worse than a single color would be.
 */
function tagTone(id: number): BadgeVariant {
	return TAG_TONES[Math.abs(id) % TAG_TONES.length];
}

/**
 * The product's tags, under its description.
 *
 * Not links: a tag has no page of its own - `term` carries wording and no slug - so a badge here
 * is a label rather than a way through. The catalog does filter on `tag_id`, and the day that
 * reaches an address these become links to it.
 *
 * Renders nothing when the product carries no tag the served language can name, so a product
 * without them gets no empty row.
 */
export function ProductTags({ tags }: { tags: ProductRefType[] }) {
	if (tags.length === 0) {
		return null;
	}

	return (
		<ul className="mt-6 flex flex-wrap gap-2">
			{tags.map((tag) => (
				<li key={tag.id}>
					<Badge variant={tagTone(tag.id)} size="xs">
						{/*
						 * Capitalized here rather than stored that way, like every other term on
						 * the page: `TermValidator` lower-cases wording on the way in so that
						 * "Sale" and "sale" cannot become two records, which leaves the display
						 * side to decide how it reads.
						 */}
						{capitalizeFirstLetter(tag.label)}
					</Badge>
				</li>
			))}
		</ul>
	);
}
