import {
	ApiRequest,
	buildQueryString,
	getResponseData,
	resolveRequestPath,
} from '@/helpers/api.helper';
import { requestFind } from '@/helpers/services.helper';
import type { ProductModel, ProductWorkflow } from '@/models/product.model';
import { ProductCompositionEnum } from '@/models/product.model';
import type { ResolvedAttributeFormType } from '@/models/product-category-attribute.model';
import type { ProductVariantModel } from '@/models/product-variant.model';
import type { ApiResponseFetch } from '@/types/api.type';
import type { Language } from '@/types/common.type';

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
}): Promise<ApiResponseFetch<ProductModel>> {
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
