import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { Icons } from '@/components/icon.component';
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
import { showImage } from '@/models/image.model';
import {
	buildVariantAxisLabel,
	formatProductPrice,
	type ProductContentType,
	type ProductListVariantType,
	type ProductPublicModel,
	resolveCardImage,
	resolvePriceRange,
} from '@/models/product.model';
import { requestPublicProduct } from '@/services/product.service';
import type { Language } from '@/types/common.type';

// A product changes on a catalog rhythm, not per request, so the read is served from Next's
// data cache. Same window as the article page, and short enough that a price edit reaches the
// storefront without waiting on a deploy.
const REVALIDATE_SECONDS = 600;

const TRANSLATION_PREFIX = 'products';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.back_to_list',
	'text.unavailable',
	'text.brand',
	'text.categories',
	'text.no_description',
	'text.price_from',
	'text.variants',
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

	const [translations, result] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
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
	 * Each category links to its own storefront listing. The label and the slug have to travel
	 * together, which is why this is not `toCategoryRefs` - that returns `{ id, label }`, and the
	 * address is built from the slug.
	 *
	 * Categories without wording are dropped rather than shown. The public read joins
	 * `category_content` on the served language alone, so an untranslated category arrives
	 * carrying no contents, and there is nothing to name it by - a bare `#<id>` is a fallback
	 * meant for an operator reading the dashboard. It is noise on a storefront.
	 */
	const categories = (entry.categories ?? []).flatMap((link) => {
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

	const variants = entry.variants ?? [];
	const selected = resolveSelectedVariant(entry, variantSku);

	// The headline figure is the selected variant's own; the span across the set is what adds the
	// "from", and only when the variants genuinely differ.
	const selectedRange = resolvePriceRange(selected ? [selected] : []);
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

			<div className="mt-6 mx-auto max-w-3xl">
				<h1 className="text-3xl md:text-4xl font-semibold">
					{content.label}
				</h1>

				<div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
					{entry.brand?.name && (
						<span>
							{translations['text.brand']}:{' '}
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
					)}

					{categories.length > 0 && (
						<span>
							{translations['text.categories']}:{' '}
							{categories.map((ref, index) => (
								<Fragment key={ref.id}>
									{index > 0 && ', '}
									<Link
										href={Routes.get('products-category', {
											slug: ref.slug,
										})}
										className="hover:underline"
									>
										{ref.label}
									</Link>
								</Fragment>
							))}
						</span>
					)}
				</div>

				{selectedRange && (
					<p className="mt-6 text-2xl font-semibold">
						{/*
						 * "from" belongs to the *set*, not to the figure beside it: it says the
						 * price moves with the choice below, which is only true when the variants
						 * actually differ.
						 */}
						{hasRange && !variantSku && (
							<span className="mr-1.5 text-base font-normal text-muted">
								{translations['text.price_from']}
							</span>
						)}
						{formatProductPrice(
							selectedRange.min,
							selectedRange.currency,
							language,
						)}
					</p>
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
												isSelected ? 'true' : undefined
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

				{hero && (
					<Image
						src={showImage(hero.path, hero.storage)}
						width={hero.properties?.width ?? 1200}
						height={hero.properties?.height ?? 675}
						alt=""
						priority
						className="mt-8 aspect-video w-full rounded-2xl object-cover"
						sizes="(min-width: 1024px) 800px, 100vw"
					/>
				)}

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
							__html: renderMarkdownServer(content.description),
						}}
					/>
				) : (
					<p className="mt-8 text-muted">
						{translations['text.no_description']}
					</p>
				)}

				<div className="mt-10 border-t border-line pt-6">
					<BackToList label={translations['text.back_to_list']} />
				</div>
			</div>
		</div>
	);
}
