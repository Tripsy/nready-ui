import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import {
	type CategoryModel,
	type CategoryType,
	getCategoryContentProp,
} from '@/models/category.model';
import { requestPublicCategories } from '@/services/category.service';
import type { Language } from '@/types/common.type';

// Same window as the category listing page: the catalogue is small and changes rarely, so a
// visitor arriving on a category page reads it from Next's data cache.
const CATEGORY_LIMIT = 200;
const REVALIDATE_SECONDS = 3600;

/**
 * Resolves a category slug to its row, by reading the whole (small) public listing for that
 * type and matching in memory.
 *
 * There is no lookup-by-slug endpoint on the backend, and the anonymous listing is capped at
 * a couple of hundred rows and cached for an hour — so the extra rows cost one cached fetch
 * rather than a query per visitor. Add a backend route once the catalogue outgrows the cap;
 * past it a slug beyond the cap resolves as "not found" rather than wrongly.
 *
 * `undefined` means "no such category"; a backend failure throws, so the two are not
 * conflated by a caller that renders a 404 for the first.
 */
export async function resolveCategoryBySlug(
	type: CategoryType,
	slug: string,
	language: Language,
): Promise<CategoryModel | undefined> {
	const response = await requestPublicCategories({
		type,
		language,
		limit: CATEGORY_LIMIT,
		revalidate: REVALIDATE_SECONDS,
	});

	if (!response?.success) {
		logger.warn('The public category list could not be read', undefined, {
			type,
		});

		throw new Error(`Could not resolve the ${type} category "${slug}"`);
	}

	const entries = getResponseData(response)?.entries ?? [];

	return entries.find(
		(entry) => getCategoryContentProp(entry, language, 'slug', '') === slug,
	);
}
