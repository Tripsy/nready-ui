import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import {
	PRODUCT_ATTRIBUTE_TRANSLATION_KEYS,
	ProductAttributes,
} from '@/app/(public)/_components/product/product-attributes.component';
import { ProductGallery } from '@/app/(public)/_components/product/product-gallery.component';
import {
	ProductRelated,
	toRelatedCategories,
} from '@/app/(public)/_components/product/product-related.component';
import { ProductTags } from '@/app/(public)/_components/product/product-tags.component';
import { AddToCart } from '@/components/cart/add-to-cart.component';
import { Icons } from '@/components/icon.component';
import {
	REVIEW_SECTION_ANCHOR,
	REVIEW_TRANSLATION_KEYS,
	REVIEW_TRANSLATION_PREFIX,
} from '@/components/review/review.definition';
import { ReviewSection } from '@/components/review/review-section.component';
import { ReviewStars } from '@/components/review/review-stars.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import { logger } from '@/helpers/logger.helper';
import { renderMarkdownServer } from '@/helpers/markdown-server.helper';
import { replaceVars } from '@/helpers/string.helper';
import {
	buildProductGallery,
	buildProductSpecifications,
	buildVariantAxisLabel,
	formatProductPrice,
	type ProductContentType,
	type ProductListVariantType,
	type ProductPublicModel,
	ProductSaleStatusEnum,
	resolveCardImage,
	resolvePriceRange,
	resolveVariantPrice,
	toPublicTagRefs,
} from '@/models/product.model';
import type { ReviewSummaryType } from '@/models/review.model';
import { requestPublicProduct } from '@/services/product.service';
import { requestPublicProductReviewSummary } from '@/services/review.service';
import type { Language } from '@/types/common.type';

// A product changes on a catalog rhythm, not per request, so the read is served from Next's
// data cache. Same window as the article page, and short enough that a price edit reaches the
// storefront without waiting on a deployment.
const REVALIDATE_SECONDS = 600;

const TRANSLATION_PREFIX = 'products';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.back_to_list',
	'text.unavailable',
	'text.no_description',
	'text.price_from',
	'text.variants',
	...PRODUCT_ATTRIBUTE_TRANSLATION_KEYS,
] as const;

/**
 * What the fetch produced, as the page has to render it: the product, or the backend being
 * unreachable. A missing product is not in here - that one is `notFound()`, which never
 * returns, and so is a product outside its sellable window, which the storefront answers 404
 * to rather than revealing through a different status.
 */
type ProductResult =
	| { status: 'ok'; entry: ProductPublicModel }
	| { status: 'unavailable' };

type Props = {
	params: Promise<{ slug: string }>;
	/*
	 * `?variant=<sku>` says which variant to open on - what an `expanded` catalog card links to.
	 * Reading it keeps this page dynamic per query string while the fetch behind it stays in
	 * Next's data cache, so the SKU costs a render rather than a request.
	 */
	searchParams: Promise<{ variant?: string }>;
};

async function getProduct(
	slug: string,
	language: Language,
): Promise<ProductResult> {
	try {
		const response = await requestPublicProduct({
			slug,
			language,
			revalidate: REVALIDATE_SECONDS,
		});

		const entry = getResponseData(response);

		if (!response?.success || !entry) {
			return { status: 'unavailable' };
		}

		return { status: 'ok', entry };
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			notFound();
		}

		logger.error('Failed to load the public product', error, { slug });

		return { status: 'unavailable' };
	}
}

/**
 * The public read returns a single translation (the language is an INNER join), so the wording
 * is whatever came back rather than a lookup across languages.
 */
function getContent(entry: ProductPublicModel): ProductContentType | undefined {
	return entry.contents?.[0];
}

/**
 * Which variant the page opens on: the one `?variant=<sku>` names, since that is how a card in
 * an `expanded` catalog grid addresses one. Falls back to the default, then to the first, so a
 * direct visit and a stale SKU both land somewhere real rather than on nothing.
 */
function resolveSelectedVariant(
	entry: ProductPublicModel,
	sku: string | undefined,
): ProductListVariantType | undefined {
	const variants = entry.variants ?? [];

	return (
		(sku ? variants.find((variant) => variant.sku === sku) : undefined) ??
		variants.find((variant) => variant.is_default) ??
		variants[0]
	);
}

/**
 * The score for the line under the heading, or `null` when there is none to show.
 *
 * Never throws: a review score is decoration on a product page, and a reviews service that is
 * down must not take the product with it. A product with no approved review answers `total: 0`
 * and is treated the same as a failure here - both mean there is no score to print.
 *
 * The client `ReviewSection` reads the same summary again and owns it from there, so a reader
 * who posts a review sees the count move without a reload. This read exists so the score is in
 * the HTML a crawler receives.
 */
async function getReviewSummary(
	productId: number,
): Promise<ReviewSummaryType | null> {
	try {
		const response = await requestPublicProductReviewSummary({
			productId,
			revalidate: REVALIDATE_SECONDS,
		});

		const summary = getResponseData(response);

		return summary && summary.total > 0 ? summary : null;
	} catch (error) {
		logger.error('Failed to load the public review summary', error, {
			productId,
		});

		return null;
	}
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { slug } = await props.params;
	const language = await getLanguage();
	const result = await getProduct(slug, language);

	if (result.status !== 'ok') {
		return {
			title: await translate('app.page.not_found', {
				app_name: Configuration.get('app.name'),
			}),
		};
	}

	const content = getContent(result.entry);

	return {
		title: content?.meta?.title || content?.label,
		description: content?.meta?.description,
		keywords: content?.meta?.keywords,
	};
}

function BackToList({ label }: { label: string }) {
	return (
		<Link
			href={Routes.get('products')}
			className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
		>
			<Icons.Direction.ArrowLeft />
			{label}
		</Link>
	);
}

export default async function Page(props: Props) {
	const { slug } = await props.params;
	const { variant: variantSku } = await props.searchParams;
	const language = await getLanguage();

	/*
	 * Each namespace is batched separately, and the review section's copy is passed down as
	 * values: its definition module is not `'use client'` precisely so this key tuple can be
	 * spread here - see `.claude/rules/comment.md` §2.
	 */
	const [translations, reviewTranslations, result] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		translateBatch(REVIEW_TRANSLATION_KEYS, REVIEW_TRANSLATION_PREFIX),
		getProduct(slug, language),
	]);

	if (result.status !== 'ok') {
		return (
			<div className="container-default py-12 md:py-16">
				<div className="mx-auto max-w-3xl">
					<BackToList label={translations['text.back_to_list']} />

					<p className="mt-10 text-muted">
						{translations['text.unavailable']}
					</p>
				</div>
			</div>
		);
	}

	const { entry } = result;
	const content = getContent(entry);

	if (!content) {
		// Sellable with no translation the visitor can be served - nothing to render.
		notFound();
	}

	/*
	 * Sequential rather than folded into the batch above: the summary is addressed by product id,
	 * which only exists once the product has resolved. One extra round trip, and it is served
	 * from Next's data cache on the same window as the product itself.
	 */
	const summary = await getReviewSummary(entry.id);

	/*
	 * The categories feed the boxes in the right-hand column and nothing else. They are not
	 * listed under the heading: a link out of a product page belongs where the visitor is looking
	 * for one, and there it comes with the neighbors it promises.
	 */
	const categories = toRelatedCategories(entry.categories);

	const variants = entry.variants ?? [];
	const selected = resolveSelectedVariant(entry, variantSku);

	/*
	 * The headline figures are the selected variant's own - what is charged, and the reference
	 * price to strike through when there is a saving to show. The span across the set is what
	 * adds the "from", and only when the variants genuinely differ.
	 */
	const selectedPrice = resolveVariantPrice(selected);
	const fullRange = resolvePriceRange(variants);
	const hasRange = !!fullRange && fullRange.min !== fullRange.max;

	/*
	 * The picture follows the choice, the same way the price does - and only once a choice has
	 * been made. Reached with `?variant=`, the hero is that variant's own photograph falling back
	 * to the product's, so a page opened from an `expanded` card shows what the card showed.
	 * Reached bare, no variant has been chosen yet and the product's own photograph is the one
	 * picked to represent the whole set; `resolveCardImage` answers both from the same rule the
	 * catalog grid uses, which is why the two can never disagree.
	 */
	const hero = resolveCardImage(
		entry,
		variantSku ? (selected ?? null) : null,
	);

	const galleryImages = buildProductGallery(entry, hero);

	/*
	 * One table for what the product says about itself and what tells the selected variant from
	 * its siblings - a reader comparing products does not care which of the two tables a figure
	 * was stored in.
	 */
	const specifications = buildProductSpecifications(entry, selected);

	const tags = toPublicTagRefs(entry);

	return (
		<div className="container-default py-12 md:py-16">
			<Breadcrumb
				items={[
					{
						label: translations['text.heading'],
						href: Routes.get('products'),
					},
					{ label: content.label },
				]}
			/>

			<div className="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-12">
				<div className="min-w-0 flex-1">
					<h1 className="text-3xl md:text-4xl font-semibold flex gap-2">
						{entry.brand?.name && (
							<span className="text-sm text-muted">
								{entry.brand.slug ? (
									<Link
										href={Routes.get('products-brand', {
											slug: entry.brand.slug,
										})}
										className="hover:underline"
									>
										{entry.brand.name}
									</Link>
								) : (
									entry.brand.name
								)}
							</span>
						)}{' '}
						{content.label}
					</h1>

					{summary && (
						<div className="mt-3 inline-flex items-center gap-2 text-sm hover:underline">
							<span className="font-medium">
								{summary.average.toFixed(1)}
							</span>

							<ReviewStars value={summary.average} size="sm" />

							<Link
								href={`#${REVIEW_SECTION_ANCHOR}`}
								className="text-muted"
							>
								{replaceVars(
									reviewTranslations['section.count'],
									{
										total: summary.total,
									},
								)}
							</Link>
						</div>
					)}

					{/*
					 * The choice itself. Only worth drawing when there is one to make - a product with
					 * a single variant has nothing to say here, and that is most of a catalog.
					 *
					 * Links rather than a control: a variant has no page of its own, so the SKU rides
					 * in the query string and the product URL stays canonical. That also keeps this a
					 * server component, so a crawler sees every variant and its price.
					 */}
					{variants.length > 1 && (
						<div className="mt-6">
							<h2 className="text-xs uppercase tracking-wide text-muted">
								{translations['text.variants']}
							</h2>

							<ul className="mt-3 flex flex-wrap gap-2">
								{variants.map((variant) => {
									const isSelected =
										variant.sku === selected?.sku;
									const range = resolvePriceRange([variant]);

									return (
										<li key={variant.id}>
											<Link
												href={`${Routes.get('product-view', { slug: content.slug })}?variant=${encodeURIComponent(variant.sku)}`}
												aria-current={
													isSelected
														? 'true'
														: undefined
												}
												className={cn(
													'block rounded-2xl border px-4 py-2 text-sm transition-colors',
													isSelected
														? 'border-accent bg-accent-soft text-accent-soft-foreground'
														: 'border-border hover:border-accent',
												)}
											>
												<span className="font-medium">
													{/*
													 * Axis values alone - the heading above already
													 * names the product. The SKU stands in for a
													 * variant carrying no axis wording, which is the
													 * only thing left that tells it apart.
													 */}
													{buildVariantAxisLabel(
														variant,
													) ?? variant.sku}
												</span>

												{range && (
													<span className="ml-2 text-muted">
														{formatProductPrice(
															range.min,
															range.currency,
															language,
														)}
													</span>
												)}
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					)}

					{/*
					 * The picture on show, and every other one the product has beside it - its own
					 * gallery and its variants'. `hero` leads the list, so what opens is still
					 * whatever `?variant=` asked for.
					 */}
					<ProductGallery
						images={galleryImages}
						label={content.label}
					/>

					{content.description ? (
						/*
						 * The stored value is markdown. `renderMarkdownServer` sanitizes it,
						 * which is what makes the injection safe; it runs here rather than on
						 * the client so the description is in the HTML a crawler receives.
						 */
						<div
							className="markdown-body mt-8"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdownServer`
							dangerouslySetInnerHTML={{
								__html: renderMarkdownServer(
									content.description,
								),
							}}
						/>
					) : (
						<p className="mt-8 text-muted">
							{translations['text.no_description']}
						</p>
					)}

					{/*
					 * Under the description, where they read as a footnote to it rather than as
					 * something to act on - a tag has no page of its own to send anyone to.
					 */}
					<ProductTags tags={tags} />

					{/*
					 * What the product says about itself, as opposed to the axes that tell its
					 * variants apart - those are already the chooser above. Renders nothing when the
					 * product records none, which is most of a catalog.
					 */}
					<ProductAttributes
						attributes={specifications}
						language={language}
						translations={translations}
					/>

					{/*
					 * `variantId` is the variant the reader *chose*, which is why it is conditional
					 * on `?variant=`: `selected` also holds the default one on a bare visit, and
					 * recording that as the thing bought would be putting words in the buyer's mouth.
					 */}
					<ReviewSection
						productId={entry.id}
						variantId={variantSku ? (selected?.id ?? null) : null}
						language={language}
						translations={reviewTranslations}
					/>
				</div>

				{/*
				 * The buying column: what it costs and how to take it, then where else to look.
				 * Sticky from `lg` up, so the price and the button stay reachable however far
				 * down the description, the specifications and the reviews run.
				 */}
				<aside className="w-full shrink-0 lg:w-96">
					<div className="flex flex-col gap-6 lg:sticky lg:top-24">
						{/*
						 * Drawn whenever there is something to buy, which is `selected` rather
						 * than `selectedPrice`: a variant quoting no price in any market the
						 * deployment reads is still addable, and a card holding only the button
						 * is better than a button with no card around it.
						 */}
						{selected && (
							<div className="rounded-2xl border border-border bg-surface p-6">
								{selectedPrice && (
									<p className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold">
										{/*
										 * The reference price comes first and struck through,
										 * which is the order the saving reads in.
										 * `resolveVariantPrice` only hands one over when it is
										 * above what is charged, so this never renders a "was"
										 * cheaper than the "now".
										 */}
										{selectedPrice.reference_price !==
											null && (
											<span className="text-base font-normal text-muted line-through">
												{formatProductPrice(
													selectedPrice.reference_price,
													selectedPrice.currency,
													language,
												)}
											</span>
										)}

										{/*
										 * "from" belongs to the *set*, not to the whole line: it
										 * says the price moves with the choice in the column
										 * beside this one, which is only true when the variants
										 * actually differ. It sits immediately before the figure
										 * it qualifies - ahead of the struck-through reference it
										 * would read as qualifying that one, which is a price
										 * nobody is being offered.
										 */}
										{hasRange && !variantSku && (
											<span className="text-base font-normal text-muted">
												{
													translations[
														'text.price_from'
													]
												}
											</span>
										)}

										<span>
											{formatProductPrice(
												selectedPrice.sale_price,
												selectedPrice.currency,
												language,
											)}
										</span>
									</p>
								)}

								{/*
								 * The one client island on the page, under the price it is about
								 * to charge. The variant is already decided by the chooser in the
								 * left column (or by the product's default), so this only carries
								 * the quantity.
								 */}
								<AddToCart
									productId={entry.id}
									variantId={selected.id}
									isAvailable={
										entry.sale_status ===
										ProductSaleStatusEnum.AVAILABLE
									}
								/>
							</div>
						)}

						{/*
						 * One box per category the product is filed under, each ending in a link
						 * into that category - the way on from this page.
						 */}
						<ProductRelated
							productId={entry.id}
							categories={categories}
							language={language}
						/>
					</div>
				</aside>
			</div>
		</div>
	);
}
