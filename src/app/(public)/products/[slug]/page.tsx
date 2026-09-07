import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { logger } from '@/helpers/logger.helper';
import { renderMarkdownServer } from '@/helpers/markdown-server.helper';
import { showImage } from '@/models/image.model';
import {
	type ProductContentType,
	type ProductModel,
	type ProductPriceType,
	toCategoryRefs,
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
] as const;

/**
 * What the fetch produced, as the page has to render it: the product, or the backend being
 * unreachable. A missing product is not in here — that one is `notFound()`, which never
 * returns, and so is a product outside its sellable window, which the storefront answers 404
 * to rather than revealing through a different status.
 */
type ProductResult =
	| { status: 'ok'; entry: ProductModel }
	| { status: 'unavailable' };

type Props = {
	params: Promise<{ slug: string }>;
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
function getContent(entry: ProductModel): ProductContentType | undefined {
	return entry.contents?.[0];
}

/**
 * The prices a visitor is quoted: those of the default variant, which is the one a product
 * with nothing to vary still reaches its price through. Falls back to the first variant so a
 * set that somehow carries no default still shows a figure rather than nothing.
 */
function getDisplayPrices(entry: ProductModel): ProductPriceType[] {
	const variants = entry.variants ?? [];
	const variant = variants.find((entry) => entry.is_default) ?? variants[0];

	return variant?.prices ?? [];
}

/**
 * Formats server-side, unlike `formatAmount` — this page is rendered for a crawler, so the
 * figure has to be in the HTML rather than filled in on hydration. Safe to do here because
 * the language comes from the request: only a *date* would pick up the container's zone.
 */
function formatPrice(
	price: ProductPriceType,
	language: Language,
): string | null {
	if (price.sale_price === null) {
		return null;
	}

	return new Intl.NumberFormat(language, {
		style: 'currency',
		currency: price.currency,
		currencyDisplay: 'narrowSymbol',
	}).format(price.sale_price);
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
		// Sellable with no translation the visitor can be served — nothing to render.
		notFound();
	}

	/*
	 * Wording only: the categories are not links. There is no per-category storefront listing
	 * to point at yet, and the address does not carry them either.
	 *
	 * Categories without wording are dropped rather than shown. The public read joins
	 * `category_content` on the served language alone, so an untranslated category arrives
	 * carrying no contents, and `toCategoryRefs` then labels it `#<id>` — a fallback meant for
	 * an operator reading the dashboard, where a bare id is something to act on. It is noise
	 * on a storefront.
	 */
	const categories = toCategoryRefs(
		{
			...entry,
			categories: (entry.categories ?? []).filter(
				(link) => link.category?.contents?.length,
			),
		},
		language,
	);

	const prices = getDisplayPrices(entry)
		.map((price) => formatPrice(price, language))
		.filter((price): price is string => price !== null);

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
							{translations['text.brand']}: {entry.brand.name}
						</span>
					)}

					{categories.length > 0 && (
						<span>
							{translations['text.categories']}:{' '}
							{categories.map((ref) => ref.label).join(', ')}
						</span>
					)}
				</div>

				{prices.length > 0 && (
					<p className="mt-6 text-2xl font-semibold">
						{prices.length > 1 && (
							<span className="mr-1.5 text-base font-normal text-muted">
								{translations['text.price_from']}
							</span>
						)}
						{prices.join(' · ')}
					</p>
				)}

				{entry.cover_image && (
					<Image
						src={showImage(
							entry.cover_image.path,
							entry.cover_image.storage,
						)}
						width={entry.cover_image.properties?.width ?? 1200}
						height={entry.cover_image.properties?.height ?? 675}
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
