import Image from 'next/image';
import Link from 'next/link';
import type { ProductListTranslations } from '@/app/(public)/_components/product/product-list';
import Routes from '@/config/routes.setup';
import { showImage } from '@/models/image.model';
import {
	buildProductPath,
	buildProductVariantPath,
	buildVariantLabel,
	formatProductPrice,
	getListContent,
	type ProductCoverImageType,
	type ProductListEntryType,
	type ProductListVariantType,
	resolveCardImage,
	resolvePriceRange,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

/** Reserves the cover's box, so a product without an image keeps the grid's rhythm. */
const COVER_WIDTH = 480;
const COVER_HEIGHT = 480;

/**
 * One card of the catalog grid.
 *
 * `variant` is what the two display modes differ by, and the only thing they differ by: given
 * one, the card names and prices that variant and links to it; given none, it names the product
 * and prices it across the whole set. Keeping both in a single component is what stops the two
 * modes drifting into two different-looking grids.
 */
export function ProductCard({
	entry,
	variant,
	language,
	translations,
}: {
	entry: ProductListEntryType;
	variant: ProductListVariantType | null;
	language: Language;
	translations: ProductListTranslations;
}) {
	const content = getListContent(entry);

	const label = variant
		? buildVariantLabel(entry, variant)
		: (content?.label ?? `#${entry.id}`);

	const href = variant
		? buildProductVariantPath(entry, variant)
		: buildProductPath(entry);

	// One variant's own price, or the span across every variant - the same helper either way, so
	// a single-variant product reads identically in both modes.
	const range = resolvePriceRange(variant ? [variant] : entry.variants);

	// Which gallery the picture comes from follows the same split as the name and the price.
	const cover = resolveCardImage(entry, variant);

	const brand = entry.brand;

	return (
		<article className="flex flex-col">
			{cover && (
				<div className="mb-3">
					{href ? (
						// Repeats the title's destination, so it is hidden from assistive tech
						// and skipped by the tab order rather than announced twice.
						<Link
							href={href}
							aria-hidden="true"
							tabIndex={-1}
							className="block"
						>
							<ProductCover image={cover} />
						</Link>
					) : (
						<ProductCover image={cover} />
					)}
				</div>
			)}

			{brand?.slug && (
				<Link
					href={Routes.get('products-brand', { slug: brand.slug })}
					className="text-xs uppercase tracking-wide text-muted hover:text-foreground transition-colors"
				>
					{brand.name}
				</Link>
			)}

			<h3 className="mt-1 text-base font-semibold">
				{href ? (
					<Link href={href} className="hover:underline">
						{label}
					</Link>
				) : (
					label
				)}
			</h3>

			{range && (
				<p className="mt-2 text-sm">
					{/*
					 * "from" only when the variants genuinely differ. The listing returns every
					 * variant precisely so this can be answered - the default variant alone
					 * cannot tell a fixed price from the bottom of a range.
					 */}
					{range.min !== range.max && (
						<span className="text-muted">
							{translations['text.price_from']}{' '}
						</span>
					)}

					{formatProductPrice(range.min, range.currency, language)}
				</p>
			)}
		</article>
	);
}

function ProductCover({ image }: { image: ProductCoverImageType }) {
	return (
		<Image
			src={showImage(image.path, image.storage)}
			// The stored dimensions are the real ones; `next/image` needs them to reserve the
			// space, and the CSS below is what actually sizes the box.
			width={image.properties?.width ?? COVER_WIDTH}
			height={image.properties?.height ?? COVER_HEIGHT}
			// Decorative: the title beneath it already names the product, and the alt would only
			// repeat it to a screen reader.
			alt=""
			className="aspect-square w-full rounded-2xl object-cover"
			sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw"
		/>
	);
}
