import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import type { ProductListEntryType } from '@/models/product.model';
import {
	type PublicProductsParams,
	requestPublicProducts,
} from '@/services/product.service';

/**
 * One page of the catalog. The infinite scroll asks for the next page with the same size, so
 * this is the step the visitor advances by rather than a hard ceiling.
 *
 * Counted in *products*, not cards: under the `expanded` display one product becomes one card
 * per variant, so a page yields an uneven number of cards. The backend paginates on the product
 * for the same reason - `pagination.total` is a product count, and a category heading that said
 * anything else would be counting a thing nobody asked about.
 */
export const PRODUCT_PAGE_SIZE = 12;

// A catalog changes on a merchandising rhythm, not per request, so the first page is served from
// Next's data cache and refreshed every ten minutes. Later pages are fetched by the browser and
// cached by TanStack Query instead. Same window as the product page, so a price edit reaches the
// listing and the detail view together.
const REVALIDATE_SECONDS = 600;

export const PRODUCT_LIST_TRANSLATION_KEYS = [
	'text.no_entries',
	'text.list_unavailable',
	'text.loading_more',
	'text.price_from',
] as const;

export type ProductListTranslations = Record<
	(typeof PRODUCT_LIST_TRANSLATION_KEYS)[number],
	string
>;

/**
 * The first page of the catalog, plus the total the pager needs to know when to stop.
 *
 * `null` means the backend could not be reached - told apart from an empty catalog, which is a
 * legitimate answer and reads very differently to a visitor.
 */
export async function loadPublicProducts(
	params: PublicProductsParams,
): Promise<{ entries: ProductListEntryType[]; total: number } | null> {
	try {
		const response = await requestPublicProducts({
			...params,
			limit: params.limit ?? PRODUCT_PAGE_SIZE,
			revalidate: REVALIDATE_SECONDS,
		});

		if (!response?.success) {
			return null;
		}

		const data = getResponseData(response);

		return {
			entries: data?.entries ?? [],
			total: data?.pagination?.total ?? data?.entries.length ?? 0,
		};
	} catch (error) {
		logger.error('Failed to load the public product list', error, {
			category_id: params.category_id,
			brand_id: params.brand_id,
		});

		return null;
	}
}
