import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { type BrandModel, displayBrandLabel } from '@/models/brand.model';
import {
	type CategoryModel,
	displayCategoryLabel,
} from '@/models/category.model';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	DiscountScopeEnum,
	type DiscountTargetScope,
} from '@/models/discount.model';
import { displayProductLabel, type ProductModel } from '@/models/product.model';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { DataSourceKey } from '@/types/data-source.key';

type TargetSource = {
	dataSource: DataSourceKey;
	/** Plural, and used as written — "Targeted Brands", "Search brands…". */
	label: string;
	// biome-ignore lint/suspicious/noExplicitAny: one map over five unrelated models
	getOptionLabel: (entry: any) => string;
	/** Extra filter params the data source needs beyond the search itself. */
	filter?: Record<string, string>;
};

/**
 * The dashboard data source behind each scope's targets, and how to name a row from it. Shared
 * by the manage form's picker and the view's target list, so the two cannot label the same row
 * differently.
 *
 * A full `Record` over `DiscountTargetScope`, so a scope added to the backend enum without an
 * entry here is a type error rather than a form that renders nothing. `order` is not a key — it
 * applies to the basket and points at nothing.
 */
export const TARGET_SOURCES: Record<DiscountTargetScope, TargetSource> = {
	[DiscountScopeEnum.CLIENT]: {
		dataSource: 'client',
		label: 'Clients',
		getOptionLabel: (entry: ClientModel) => displayClientLabel(entry),
	},
	[DiscountScopeEnum.CATEGORY]: {
		dataSource: 'category',
		label: 'Categories',
		/*
		 * The backend defaults this filter to `article`, so without it a discount could only
		 * ever be pointed at blog categories — never at the product tree it is meant for.
		 */
		filter: { type: 'product' },
		getOptionLabel: (entry: CategoryModel) =>
			displayCategoryLabel(entry, getLanguageClient(), false),
	},
	[DiscountScopeEnum.BRAND]: {
		dataSource: 'brand',
		label: 'Brands',
		getOptionLabel: (entry: BrandModel) => displayBrandLabel(entry),
	},
	/*
	 * Neither of the two below narrows the catalog it searches. A launch offer is written while
	 * the product is still a draft, so filtering on `is_sellable` would hide exactly the rows a
	 * scheduled campaign is for.
	 */
	[DiscountScopeEnum.PRODUCT]: {
		dataSource: 'product',
		label: 'Products',
		getOptionLabel: (entry: ProductModel) => displayProductLabel(entry),
	},
	[DiscountScopeEnum.VARIANT]: {
		dataSource: 'product-variant',
		label: 'Variants',
		getOptionLabel: (entry: ProductVariantModel) =>
			displayProductVariantLabel(entry),
	},
};

/**
 * Names the rows a set of target ids points at, as `{ [id]: label }`.
 *
 * One request per scope rather than one per id — every listing behind `TARGET_SOURCES` takes a
 * list on `filter[id]`. `limit` is the number asked for, so the page can never cut the answer
 * short.
 *
 * An id the listing does not return is simply absent, and the caller falls back to showing the
 * bare id. That is the honest outcome for a target whose row was soft-deleted after the link was
 * made: the link is still stored and still shown, only its name is gone.
 */
export async function findTargetLabels(
	scope: DiscountTargetScope,
	ids: readonly number[],
): Promise<Record<number, string>> {
	if (ids.length === 0) {
		return {};
	}

	const source = TARGET_SOURCES[scope];

	const response:
		| FindFunctionResponseType<Record<string, unknown>>
		| undefined = await requestFind(source.dataSource, {
		filter: { id: [...ids], ...source.filter },
		limit: ids.length,
	});

	return Object.fromEntries(
		(response?.entries ?? []).map((entry) => [
			entry.id as number,
			source.getOptionLabel(entry),
		]),
	);
}
