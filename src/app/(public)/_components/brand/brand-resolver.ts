import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import { type BrandModel, BrandTypeEnum } from '@/models/brand.model';
import { requestPublicBrands } from '@/services/brand.service';
import type { Language } from '@/types/common.type';

// Brands are a short, slow-moving list, so a visitor arriving on a brand page reads it from
// Next's data cache rather than costing a query.
const BRAND_LIMIT = 200;
const REVALIDATE_SECONDS = 3600;

/**
 * Resolves a brand slug to its row, by reading the whole (small) public listing and matching in
 * memory - the same approach, and the same reasoning, as `resolveCategoryBySlug`.
 *
 * There is no lookup-by-slug endpoint on the backend. Add one once the catalog outgrows the cap;
 * past it a slug beyond the cap resolves as "not found" rather than wrongly.
 *
 * `undefined` means "no such brand"; a backend failure throws, so the two are not conflated by a
 * caller that renders a 404 for the first.
 */
export async function resolveBrandBySlug(
	slug: string,
	language: Language,
): Promise<BrandModel | undefined> {
	const response = await requestPublicBrands({
		brand_type: BrandTypeEnum.PRODUCT,
		language,
		limit: BRAND_LIMIT,
		revalidate: REVALIDATE_SECONDS,
	});

	if (!response?.success) {
		logger.warn('The public brand list could not be read', undefined, {
			slug,
		});

		throw new Error(`Could not resolve the brand "${slug}"`);
	}

	const entries = getResponseData(response)?.entries ?? [];

	return entries.find((entry) => entry.slug === slug);
}

/**
 * The brand's own words, as the public listing carries them. Read straight off the joined row
 * rather than through `getBrandDescription`, which answers `[empty description]` for a brand
 * that has none - a placeholder written for the dashboard and not for a visitor. The public
 * listing joins a single language, so there is one content row at most.
 */
export function getPublicBrandDescription(brand: BrandModel): string {
	return brand.contents?.[0]?.description ?? '';
}
