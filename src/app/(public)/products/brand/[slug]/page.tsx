import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
	getPublicBrandDescription,
	resolveBrandBySlug,
} from '@/app/(public)/_components/brand/brand-resolver';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { ProductFeed } from '@/app/(public)/_components/product/product-feed.component';
import {
	loadPublicProducts,
	PRODUCT_LIST_TRANSLATION_KEYS,
	PRODUCT_PAGE_SIZE,
} from '@/app/(public)/_components/product/product-list';
import Routes from '@/config/routes.setup';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';
import { logger } from '@/helpers/logger.helper';
import type { BrandModel } from '@/models/brand.model';
import type { Language } from '@/types/common.type';

const TRANSLATION_PREFIX = 'products';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.brand_subheading',
	...PRODUCT_LIST_TRANSLATION_KEYS,
] as const;

type Props = {
	params: Promise<{ slug: string }>;
};

/**
 * `undefined` is a slug nobody publishes under - a 404. `null` is the backend being unreachable,
 * which is a temporary failure and must not be answered with one.
 */
async function getBrand(
	slug: string,
	language: Language,
): Promise<BrandModel | undefined | null> {
	try {
		return await resolveBrandBySlug(slug, language);
	} catch (error) {
		logger.error('Failed to resolve the brand', error, { slug });

		return null;
	}
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { slug } = await props.params;
	const language = await getLanguage();
	const brand = await getBrand(slug, language);

	if (!brand) {
		return {
			title: await translate(`${TRANSLATION_PREFIX}.meta.title`),
		};
	}

	return {
		title: brand.contents?.[0]?.meta?.title || brand.name,
		description:
			brand.contents?.[0]?.meta?.description ||
			getPublicBrandDescription(brand),
	};
}

export default async function Page(props: Props) {
	const { slug } = await props.params;
	const language = await getLanguage();

	const [translations, brand] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		getBrand(slug, language),
	]);

	if (brand === undefined) {
		notFound();
	}

	// The brand has to resolve before the products can be asked for: the backend filters them by
	// id, and the URL carries a slug.
	const page = brand
		? await loadPublicProducts({ language, brand_id: brand.id })
		: null;

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb
					items={[
						{
							label: translations['text.heading'],
							href: Routes.get('products'),
						},
						{ label: brand?.name ?? '' },
					]}
				/>

				<h1 className="mt-8 text-2xl md:text-3xl font-semibold">
					{brand?.name}
				</h1>
				<p className="mt-2 text-muted">
					{(brand && getPublicBrandDescription(brand)) ||
						translations['text.brand_subheading']}
				</p>

				<ProductFeed
					initialEntries={page?.entries ?? null}
					initialTotal={page?.total ?? 0}
					pageSize={PRODUCT_PAGE_SIZE}
					language={language}
					brandId={brand?.id}
					translations={translations}
				/>
			</div>
		</div>
	);
}
