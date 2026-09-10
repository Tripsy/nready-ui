import Image from 'next/image';
import Link from 'next/link';
import {
	loadPublicProducts,
	PRODUCT_LIST_TRANSLATION_KEYS,
} from '@/app/(public)/_components/product/product-list';
import { Icons } from '@/components/icon.component';
import Routes from '@/config/routes.setup';
import { translateBatch } from '@/config/translate.setup';
import { replaceVars } from '@/helpers/string.helper';
import { showImage } from '@/models/image.model';
import {
	buildProductPath,
	formatProductPrice,
	getListContent,
	type ProductListEntryType,
	resolveCardImage,
	resolvePriceRange,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

const TRANSLATION_PREFIX = 'products';

const TRANSLATION_KEYS = [
	...PRODUCT_LIST_TRANSLATION_KEYS,
	'text.related_heading',
	'text.related_more',
] as const;

/**
 * How many neighbours one box shows.
 *
 * Four rather than the grid's twelve: the rail sits in the page's narrow column beside the
 * product, one row per entry, and a longer list would push the "see more" link off the first
 * screen - which is the link the box exists to offer.
 */
const RELATED_LIMIT = 4;

/** The rail's thumbnail box, in CSS pixels. Square, so a missing image never shifts the row. */
const THUMBNAIL_SIZE = 64;

/** One category the product is filed under, as the rail addresses it. */
export type RelatedCategoryType = {
	id: number;
	label: string;
	slug: string;
};

/**
 * A rail of neighbours per category the product is filed under - a product in two categories gets
 * two boxes, each headed by that category and ending in a link into it.
 *
 * One request per category rather than one across them all: a box is *about* its category, so a
 * merged list could not say which of them a given neighbour came from, and the "see more" link
 * under it would have nowhere to point. The requests run in parallel and each is served from
 * Next's data cache, so the cost is one round trip's latency however many categories there are.
 *
 * `exclude_id` keeps the product off its own rail - the listing filter exists for exactly this.
 *
 * A category whose listing comes back empty (or unreachable) renders no box at all: an empty rail
 * says nothing a visitor can act on, and it is the ordinary state of a category holding only this
 * product.
 */
export async function ProductRelated({
	productId,
	categories,
	language,
}: {
	productId: number;
	categories: RelatedCategoryType[];
	language: Language;
}) {
	if (categories.length === 0) {
		return null;
	}

	const [translations, ...results] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		...categories.map((category) =>
			loadPublicProducts({
				language,
				category_id: category.id,
				exclude_id: productId,
				limit: RELATED_LIMIT,
			}),
		),
	]);

	const boxes = categories.flatMap((category, index) => {
		const entries = results[index]?.entries ?? [];

		return entries.length > 0 ? [{ category, entries }] : [];
	});

	if (boxes.length === 0) {
		return null;
	}

	/*
	 * A fragment, not a wrapper: the boxes are laid out by the page's own right-hand column
	 * alongside the price card, and a `<div>` here would put them in a box of their own inside
	 * that column's gap.
	 */
	return (
		<>
			{boxes.map(({ category, entries }) => (
				<section
					key={category.id}
					className="rounded-2xl border border-border bg-surface p-6"
				>
					<h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
						{replaceVars(translations['text.related_heading'], {
							category: category.label,
						})}
					</h2>

					<ul className="mt-4 divide-y divide-line">
						{entries.map((entry) => (
							<RelatedRow
								key={entry.id}
								entry={entry}
								language={language}
								translations={translations}
							/>
						))}
					</ul>

					<Link
						href={Routes.get('products-category', {
							slug: category.slug,
						})}
						className="mt-5 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
					>
						{replaceVars(translations['text.related_more'], {
							category: category.label,
						})}
						<Icons.Direction.ArrowRight />
					</Link>
				</section>
			))}
		</>
	);
}

/**
 * One neighbour, as a row: a small square picture on the left and the wording on the right.
 *
 * A row rather than the catalog's `ProductCard`, which stacks a full-width cover above its text -
 * the right-hand column is a third of the page, and four of those covers would be taller than the
 * product they are recommended beside. Same data, read left to right instead of top to bottom.
 *
 * Priced across the whole variant set, so it says "from" exactly when the catalog grid does; the
 * rail suggests a *product*, and one spread over its variants would crowd out the other three.
 *
 * The picture keeps its box even when the product has none, so the four rows stay on one left
 * edge - a ragged column reads as a rendering fault rather than as missing photography.
 */
function RelatedRow({
	entry,
	language,
	translations,
}: {
	entry: ProductListEntryType;
	language: Language;
	translations: Record<
		(typeof PRODUCT_LIST_TRANSLATION_KEYS)[number],
		string
	>;
}) {
	const content = getListContent(entry);
	const label = content?.label ?? `#${entry.id}`;
	const href = buildProductPath(entry);
	const cover = resolveCardImage(entry, null);
	const range = resolvePriceRange(entry.variants);

	return (
		<li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
			<div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted-background">
				{cover && (
					<Image
						src={showImage(cover.path, cover.storage)}
						// The stored dimensions are the real ones; `next/image` needs them to
						// reserve the space, and the CSS above is what actually sizes the box.
						width={cover.properties?.width ?? THUMBNAIL_SIZE}
						height={cover.properties?.height ?? THUMBNAIL_SIZE}
						// Decorative: the title beside it already names the product, and the alt
						// would only repeat it to a screen reader.
						alt=""
						className="size-full object-cover"
						sizes={`${THUMBNAIL_SIZE}px`}
					/>
				)}
			</div>

			<div className="min-w-0">
				{entry.brand?.slug && (
					<Link
						href={Routes.get('products-brand', {
							slug: entry.brand.slug,
						})}
						className="text-[0.7rem] uppercase tracking-wide text-muted hover:text-foreground transition-colors"
					>
						{entry.brand.name}
					</Link>
				)}

				<h3 className="text-sm font-medium leading-snug">
					{href ? (
						<Link href={href} className="hover:underline">
							{label}
						</Link>
					) : (
						label
					)}
				</h3>

				{range && (
					<p className="mt-1 text-sm">
						{range.min !== range.max && (
							<span className="text-muted">
								{translations['text.price_from']}{' '}
							</span>
						)}

						{formatProductPrice(
							range.min,
							range.currency,
							language,
						)}
					</p>
				)}
			</div>
		</li>
	);
}

/**
 * The categories a product page can build a rail from - those carrying wording *and* a slug in
 * the served language.
 *
 * The public read joins `category_content` on that language alone, so an untranslated category
 * arrives with no contents: there is nothing to head its box with and no address to send the
 * visitor to. A bare `#<id>` is a fallback meant for an operator reading the dashboard, and it is
 * noise on a storefront.
 */
export function toRelatedCategories(
	links:
		| {
				category_id: number;
				category?: {
					contents?: { label: string; slug?: string }[];
				} | null;
		  }[]
		| undefined,
): RelatedCategoryType[] {
	return (links ?? []).flatMap((link) => {
		const content = link.category?.contents?.[0];

		return content?.label && content.slug
			? [
					{
						id: link.category_id,
						label: content.label,
						slug: content.slug,
					},
				]
			: [];
	});
}
