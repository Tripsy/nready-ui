'use client';

import { useQuery } from '@tanstack/react-query';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import {
	type ProductStockStatus,
	ProductStockStatusEnum,
	type ProductVariantStockType,
} from '@/models/product.model';
import { requestPublicProductStock } from '@/services/product.service';

/** The copy for each level, handed down from the page's server-side batch. */
export type ProductStockStatusLabels = Record<ProductStockStatus, string>;

const TONE: Record<ProductStockStatus, string> = {
	[ProductStockStatusEnum.IN_STOCK]: 'text-success',
	[ProductStockStatusEnum.LOW_STOCK]: 'text-warning',
	[ProductStockStatusEnum.BACKORDER]: 'text-muted',
	[ProductStockStatusEnum.OUT_OF_STOCK]: 'text-danger',
};

/**
 * "In stock" / "Low stock" / "Out of stock" for the variant on show - a level, never a count.
 *
 * A client island on a page otherwise served from Next's data cache: the product read is minutes
 * old by design, and a level is only worth stating while it is true, so it is asked from the
 * browser on its own route. One request covers every variant of the product, so switching
 * variants through `?variant=` re-reads nothing within the stale window.
 *
 * Renders nothing while loading, on failure, and for a variant that keeps no stock - the line is
 * information beside the buy button, not a gate on it (the cart is what refuses a short line), so
 * a missing answer is better left unsaid than shown as an error.
 */
export function ProductStockStatusLine({
	productId,
	variantId,
	labels,
	className,
}: {
	productId: number;
	variantId: number;
	labels: ProductStockStatusLabels;
	className?: string;
}) {
	const { data } = useQuery({
		queryKey: ['product', 'stock', productId],
		queryFn: async (): Promise<ProductVariantStockType[]> => {
			const response = getResponseData(
				await requestPublicProductStock(productId),
			);

			if (!response) {
				throw new Error('Could not retrieve the product stock');
			}

			return response.entries;
		},
		// Short against the 5-minute default: a shopper lingering on the page should not be told
		// "in stock" long after the last unit went
		staleTime: 30_000,
	});

	const status = data?.find(
		(entry) => entry.variant_id === variantId,
	)?.stock_status;

	if (!status) {
		return null;
	}

	return (
		<p
			className={cn(
				'flex items-center gap-2 text-sm font-medium',
				TONE[status],
				className,
			)}
		>
			{/* `bg-current` takes the line's own tone, so the dot never disagrees with the words */}
			<span
				aria-hidden="true"
				className="inline-block h-2 w-2 rounded-full bg-current"
			/>
			{labels[status]}
		</p>
	);
}
