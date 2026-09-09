'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ProductCard } from '@/app/(public)/_components/product/product-card.component';
import type { ProductListTranslations } from '@/app/(public)/_components/product/product-list';
import { Configuration } from '@/config/settings.config';
import { getResponseData } from '@/helpers/api.helper';
import type {
	ProductListEntryType,
	ProductListVariantType,
} from '@/models/product.model';
import { ProductVariantDisplayEnum } from '@/models/product-display.model';
import { requestPublicProductsPage } from '@/services/product.service';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { Language } from '@/types/common.type';

/** One rendered card: a product, and the variant it stands for under the `expanded` display. */
type ProductCardEntry = {
	key: string;
	entry: ProductListEntryType;
	variant: ProductListVariantType | null;
};

/**
 * Turns the fetched product rows into the cards the grid draws.
 *
 * This is where the whole `expanded` / `collapsed` decision lives, and the reason it is a
 * frontend concern at all: the backend stays product-rooted and product-paginated, so neither
 * `pagination.total` nor the facet path has to know which shape the storefront chose.
 *
 * A product whose variants did not come back still yields its own card rather than vanishing
 * from an `expanded` grid.
 */
function toCards(
	entries: ProductListEntryType[],
	expanded: boolean,
): ProductCardEntry[] {
	if (!expanded) {
		return entries.map((entry) => ({
			key: String(entry.id),
			entry,
			variant: null,
		}));
	}

	return entries.flatMap((entry): ProductCardEntry[] => {
		const variants = entry.variants ?? [];

		if (variants.length === 0) {
			return [{ key: String(entry.id), entry, variant: null }];
		}

		return variants.map((variant) => ({
			key: `${entry.id}-${variant.id}`,
			entry,
			variant,
		}));
	});
}

/**
 * The public product grid, shared by `/products`, a category's page and a brand's page.
 *
 * The first page is rendered on the server and handed over as `initialEntries`, so the grid is
 * in the HTML a crawler reads and the first paint needs no fetch. Later pages are pulled in as
 * the visitor reaches the end - through the proxy, since this runs in the browser and only the
 * proxy may talk to the backend from there.
 */
export function ProductFeed({
	initialEntries,
	initialTotal,
	pageSize,
	language,
	categoryId,
	brandId,
	translations,
}: {
	initialEntries: ProductListEntryType[] | null;
	initialTotal: number;
	pageSize: number;
	language: Language;
	categoryId?: number;
	brandId?: number;
	translations: ProductListTranslations;
}) {
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	const query = useInfiniteQuery({
		queryKey: [
			'products',
			'feed',
			categoryId ?? null,
			brandId ?? null,
			language,
		],
		queryFn: async ({ pageParam }) => {
			const response = await requestPublicProductsPage({
				language,
				category_id: categoryId,
				brand_id: brandId,
				page: pageParam,
				limit: pageSize,
			});

			const data = getResponseData(response);

			if (!response?.success || !data) {
				throw new Error('Could not retrieve the product list');
			}

			return data;
		},
		initialPageParam: 1,
		// The server already fetched page one; refetching it on mount would duplicate every card
		// for a moment and waste the request the page just made.
		initialData: initialEntries
			? {
					pages: [
						{
							entries: initialEntries,
							pagination: {
								page: 1,
								limit: pageSize,
								total: initialTotal,
							},
						} as FindFunctionResponseType<ProductListEntryType>,
					],
					pageParams: [1],
				}
			: undefined,
		/*
		 * Counted in products, against a total that is also products - never in cards. Under the
		 * `expanded` display a page of twelve products can draw thirty cards, and comparing that
		 * to the total would stop the feed early.
		 */
		getNextPageParam: (lastPage, pages) => {
			const total = lastPage.pagination?.total ?? 0;
			const loaded = pages.reduce(
				(count, page) => count + page.entries.length,
				0,
			);

			return loaded < total ? pages.length + 1 : undefined;
		},
		enabled: initialEntries !== null,
	});

	const entries = query.data?.pages.flatMap((page) => page.entries) ?? [];

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

	useEffect(() => {
		const sentinel = sentinelRef.current;

		if (!sentinel || !hasNextPage) {
			return;
		}

		/*
		 * `rootMargin` starts the fetch before the sentinel is actually on screen, so the next
		 * cards are usually there by the time the visitor arrives. The observer is rebuilt
		 * whenever `hasNextPage` flips, which is also what disconnects it at the end.
		 */
		const observer = new IntersectionObserver(
			(observed) => {
				if (observed[0]?.isIntersecting && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ rootMargin: '400px 0px' },
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (initialEntries === null || query.isError) {
		return (
			<p className="mt-10 text-muted">
				{translations['text.list_unavailable']}
			</p>
		);
	}

	if (entries.length === 0) {
		return (
			<p className="mt-10 text-muted">
				{translations['text.no_entries']}
			</p>
		);
	}

	const cards = toCards(
		entries,
		Configuration.get('product.variantDisplay') ===
			ProductVariantDisplayEnum.EXPANDED,
	);

	return (
		<div className="mt-10">
			<div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
				{cards.map((card) => (
					<ProductCard
						key={card.key}
						entry={card.entry}
						variant={card.variant}
						language={language}
						translations={translations}
					/>
				))}
			</div>

			{/* Watched by the observer above; sits below the last row on purpose. */}
			<div ref={sentinelRef} aria-hidden="true" className="h-px" />

			{isFetchingNextPage && (
				<p className="mt-8 text-center text-sm text-muted">
					{translations['text.loading_more']}
				</p>
			)}
		</div>
	);
}
