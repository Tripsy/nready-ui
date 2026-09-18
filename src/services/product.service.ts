import {
	ApiRequest,
	buildQueryString,
	getResponseData,
	resolveRequestPath,
} from '@/helpers/api.helper';
import { requestFind } from '@/helpers/services.helper';
import type {
	ProductListEntryType,
	ProductPublicModel,
	ProductWorkflow,
} from '@/models/product.model';
import { ProductCompositionEnum } from '@/models/product.model';
import type { ResolvedAttributeFormType } from '@/models/product-category-attribute.model';
import type { ProductVariantModel } from '@/models/product-variant.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { ApiResponseFetch } from '@/types/api.type';
import type { Language } from '@/types/common.type';

export type PublicProductsParams = {
	language?: Language;
	term?: string;
	category_id?: number;
	brand_id?: number;
	/** Any of these tags. */
	tag_id?: number[];
	/** Product to leave out, so a "related" rail never recommends the page it sits on. */
	exclude_id?: number;
	page?: number;
	limit?: number;
};

function buildPublicProductsQuery(params: PublicProductsParams): string {
	const {
		page,
		limit,
		language,
		term,
		category_id,
		brand_id,
		tag_id,
		exclude_id,
	} = params;

	return buildQueryString({
		order_by: 'created_at',
		direction: 'DESC',
		page,
		limit,
		filter: {
			language,
			term,
			category_id,
			brand_id,
			tag_id,
			exclude_id,
		},
	});
}

/**
 * The anonymous catalog listing (`GET /public/products`), which reaches only the sellable window
 * and accepts none of the dashboard filters that could widen it.
 *
 * Server-side only, via `remote-api`: the `/api/proxy` route the dashboard uses attaches the
 * session cookie, and this page has no visitor to attach. Going straight to the backend also lets
 * the response participate in Next's data cache - `revalidate` is the caller's to set, since only
 * it knows how fresh the listing has to be.
 *
 * Each row carries every live variant with its prices and its axis wording, not just the default
 * one - which is what lets a card price itself from a range and, under the `expanded` display,
 * become one card per variant.
 */
export async function requestPublicProducts(
	params: PublicProductsParams & { revalidate?: number },
): Promise<ApiResponseFetch<FindFunctionResponseType<ProductListEntryType>>> {
	const { revalidate, ...filters } = params;

	const query = buildPublicProductsQuery(filters);

	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(`/public/products${query ? `?${query}` : ''}`, {
			method: 'GET',
			next: { revalidate },
		});
}

/**
 * The same listing, for a **client** component - the infinite-scroll feed asking for page two and
 * beyond.
 *
 * Goes through `/api/proxy` (the default request mode) rather than `remote-api`: a browser cannot
 * reach the backend directly, and the proxy is the only sanctioned path from there. No
 * `revalidate` either - a client fetch does not participate in Next's data cache, and TanStack
 * Query is what holds the pages already loaded.
 */
export async function requestPublicProductsPage(
	params: PublicProductsParams,
): Promise<ApiResponseFetch<FindFunctionResponseType<ProductListEntryType>>> {
	const query = buildPublicProductsQuery(params);

	return await new ApiRequest().doFetch(
		`/public/products${query ? `?${query}` : ''}`,
		{ method: 'GET' },
	);
}

/**
 * One sellable product by slug (`GET /public/products/:slug`), description and variants
 * included.
 *
 * The storefront surface carries no policy: what a visitor may see is decided by the query,
 * which only ever reaches the sellable window. A draft, an unreleased or a withdrawn product
 * answers 404 rather than leaking its existence through a different status code - and that is
 * also what makes the response safe to keep in Next's shared data cache, since it can only
 * hold what any visitor may read.
 */
export async function requestPublicProduct(params: {
	slug: string;
	language?: Language;
	revalidate?: number;
}): Promise<ApiResponseFetch<ProductPublicModel>> {
	const { slug, language, revalidate } = params;

	const query = buildQueryString({ language });

	return await new ApiRequest()
		.setRequestMode('remote-api')
		.doFetch(
			`/public/products/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`,
			{
				method: 'GET',
				next: { revalidate },
			},
		);
}

/**
 * Variants a bundle may take as components, matched by SKU or by their product's name.
 *
 * Filtered on `composition: 'simple'` at the source rather than after the fact: a component
 * pointing at another bundle's variant is rejected by the backend with a 422, and excluding them
 * from the picker means the user never gets that far. Nested bundles are forbidden because the
 * order line explodes a bundle into one child per component, and a child that is itself a bundle
 * would have to explode again with nothing to stop it.
 */
export async function findBundleCandidates(
	term: string,
): Promise<ProductVariantModel[]> {
	const response = await requestFind<ProductVariantModel>('product-variant', {
		filter: {
			term,
			composition: ProductCompositionEnum.SIMPLE,
		},
		limit: 10,
	});

	return response?.entries ?? [];
}

/**
 * The variants a set of ids names, for putting a name against components a stored bundle holds
 * only as `variant_id`.
 *
 * One request rather than one per component - the listing's `id` filter takes a list for exactly
 * this. Returns a map so the caller looks up by id rather than scanning; ids that no longer
 * resolve are simply absent, which is what lets the form render a withdrawn component as unknown
 * instead of failing to load.
 */
export async function findVariantsByIds(
	ids: number[],
): Promise<Map<number, ProductVariantModel>> {
	if (ids.length === 0) {
		return new Map();
	}

	const response = await requestFind<ProductVariantModel>('product-variant', {
		filter: { id: ids },
		limit: ids.length,
	});

	return new Map((response?.entries ?? []).map((entry) => [entry.id, entry]));
}

/**
 * Moves a product through its editorial workflow (`PATCH /products/:id/workflow/:workflow`).
 */
export async function requestUpdateProductWorkflow(
	id: number,
	workflow: ProductWorkflow,
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('product')}/${id}/workflow/${workflow}`,
		{
			method: 'PATCH',
		},
	);
}

/**
 * The attribute form a product in these categories renders from
 * (`GET /product-category-attributes/resolve`).
 *
 * Takes the categories rather than a product id: a product being created has none yet, and the
 * form has to be drawn the moment its categories are picked. The answer is the union across
 * them and their ancestors, deduped by label with the deepest category winning, split by scope
 * - the walk `.claude/rules/product.md` §12.6 describes, done server-side.
 *
 * An empty list of categories short-circuits: the endpoint requires at least one, and a product
 * with none has no form to draw.
 */
export async function requestResolvedAttributes(
	categoryIds: number[],
): Promise<ResolvedAttributeFormType> {
	if (categoryIds.length === 0) {
		return { product: [], variant: [] };
	}

	const query = buildQueryString({ category_id: categoryIds });

	const response: ApiResponseFetch<ResolvedAttributeFormType> =
		await new ApiRequest().doFetch(
			`/${resolveRequestPath('product-category-attribute')}/resolve?${query}`,
		);

	return getResponseData(response) ?? { product: [], variant: [] };
}

/**
 * Reorders one category's attribute definitions (`PATCH /product-category-attributes/order`).
 *
 * `positions` is that category's definition ids in the order they should be offered - the whole
 * set, because a position only means anything relative to its siblings and the backend refuses
 * anything short of it.
 */
export async function requestAttributeOrderUpdate(
	category_id: number,
	positions: number[],
): Promise<ApiResponseFetch<null>> {
	return await new ApiRequest().doFetch(
		`/${resolveRequestPath('product-category-attribute')}/order`,
		{
			method: 'PATCH',
			body: JSON.stringify({ category_id, positions }),
		},
	);
}
