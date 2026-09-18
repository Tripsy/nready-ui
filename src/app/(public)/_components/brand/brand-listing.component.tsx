import Link from 'next/link';
import { getPublicBrandDescription } from '@/app/(public)/_components/brand/brand-resolver';
import { Icons } from '@/components/icon.component';
import { getLanguage, translateBatch } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import type { BrandModel, BrandType } from '@/models/brand.model';
import { requestPublicBrands } from '@/services/brand.service';
import type { Language } from '@/types/common.type';

/**
 * Brands are a short, slow-moving list, so the page shows all of them rather than paginating.
 * The cap is a guard against a catalog that outgrows that assumption: past it the listing is
 * still correct, only incomplete. Kept in step with `resolveBrandBySlug`, so a brand that is
 * listed here also resolves on its own page.
 */
const BRAND_LIMIT = 200;

// The page is anonymous and the list changes rarely, so it is served from Next's data cache and
// refreshed hourly rather than hitting the backend per visitor.
const REVALIDATE_SECONDS = 3600;

/**
 * Builds the href for one brand, from its slug. A surface with no page per brand omits it and
 * every name renders as plain text - a link to a 404 is worse than none.
 */
export type BuildBrandHref = (slug: string) => string;

/**
 * Keys are resolved under the caller's `translationPrefix`, so each surface keeps its own
 * wording while sharing this markup.
 */
export const BRAND_LISTING_TRANSLATION_KEYS = [
	'text.heading',
	'text.subheading',
	'text.no_entries',
	'text.unavailable',
] as const;

/**
 * `null` means the backend could not be reached - told apart from an empty list, which is a
 * legitimate answer and reads very differently to a visitor.
 */
async function getBrands(
	brand_type: BrandType,
	language: Language,
): Promise<BrandModel[] | null> {
	try {
		const response = await requestPublicBrands({
			brand_type,
			language,
			limit: BRAND_LIMIT,
			revalidate: REVALIDATE_SECONDS,
		});

		if (!response?.success) {
			return null;
		}

		return getResponseData(response)?.entries ?? [];
	} catch (error) {
		logger.error('Failed to load the public brand list', error, {
			brand_type,
		});

		return null;
	}
}

export async function BrandListing({
	type,
	translationPrefix,
	buildBrandHref,
}: {
	type: BrandType;
	translationPrefix: string;
	buildBrandHref?: BuildBrandHref;
}) {
	const language = await getLanguage();

	const [translations, brands] = await Promise.all([
		translateBatch(BRAND_LISTING_TRANSLATION_KEYS, translationPrefix),
		getBrands(type, language),
	]);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<h1 className="text-2xl md:text-3xl font-semibold">
					{translations['text.heading']}
				</h1>
				<p className="mt-2 text-muted">
					{translations['text.subheading']}
				</p>

				{brands === null && (
					<p className="mt-10 text-muted">
						{translations['text.unavailable']}
					</p>
				)}

				{brands?.length === 0 && (
					<p className="mt-10 text-muted">
						{translations['text.no_entries']}
					</p>
				)}

				{brands && brands.length > 0 && (
					<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{brands.map((brand) => {
							const href =
								buildBrandHref && brand.slug
									? buildBrandHref(brand.slug)
									: null;
							const description =
								getPublicBrandDescription(brand);

							return (
								<section
									key={brand.id}
									className="rounded-2xl border border-border bg-surface p-6"
								>
									<h2 className="flex items-center gap-2 text-lg font-semibold">
										<Icons.Brand className="opacity-40" />
										{href ? (
											<Link
												href={href}
												className="hover:underline"
											>
												{brand.name}
											</Link>
										) : (
											brand.name
										)}
									</h2>

									{description && (
										<p className="mt-2 text-sm text-muted">
											{description}
										</p>
									)}
								</section>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
