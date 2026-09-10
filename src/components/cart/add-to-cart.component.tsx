'use client';

import { type JSX, useState } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/use-cart.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useToast } from '@/providers/toast.provider';

const TRANSLATION_KEYS = [
	'cart.storefront.add',
	'cart.storefront.adding',
	'cart.storefront.added',
	'cart.storefront.add_failed',
	'cart.storefront.unavailable',
	'cart.storefront.quantity',
	'cart.storefront.increase',
	'cart.storefront.decrease',
] as const;

/** The same ceiling the backend validator holds; a mismatch would surface as a 422 the form let through. */
const QUANTITY_MAX = 999;

/**
 * The add-to-cart control on a product page.
 *
 * A client island inside an otherwise server-rendered page: the page itself stays cacheable and
 * crawlable, and only this button needs the viewer's own cart. The variant is chosen above it
 * through links that put the SKU in the query string, so by the time this renders the choice is
 * already made and it only has to carry the quantity.
 *
 * **Options are not offered here.** A product's option groups are not in the public read
 * (`getPublicEntryById` joins the catalog and the translations, not `product_option_group`), so
 * there is nothing to render them from - the line is added without any, which the backend accepts.
 * Exposing them is a change to the product endpoint, not to this component.
 */
export function AddToCart({
	productId,
	variantId,
	isAvailable = true,
}: {
	readonly productId: number;
	readonly variantId: number;
	/** False while the product is outside its sellable window - the backend would refuse the line anyway. */
	readonly isAvailable?: boolean;
}): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { showToast } = useToast();
	const { addItem } = useCart();

	const [quantity, setQuantity] = useState(1);

	const isPending = addItem.isPending;

	const onAdd = () => {
		addItem.mutate(
			{
				product_id: productId,
				variant_id: variantId,
				quantity: quantity,
			},
			{
				onSuccess: () => {
					showToast({
						severity: 'success',
						summary: translations['cart.storefront.added'],
					});

					// Back to one: the next thing the shopper adds is its own decision, and
					// leaving the stepper at four silently adds four of it.
					setQuantity(1);
				},
				onError: () => {
					showToast({
						severity: 'error',
						summary: translations['cart.storefront.add_failed'],
					});
				},
			},
		);
	};

	if (!isAvailable) {
		return (
			<Button
				type="button"
				variant="outline"
				disabled
				className="mt-6 w-full sm:w-auto"
			>
				{translations['cart.storefront.unavailable']}
			</Button>
		);
	}

	return (
		<div className="mt-6 flex flex-wrap items-center gap-3">
			<fieldset
				className="flex items-center rounded-2xl border border-border"
				aria-label={translations['cart.storefront.quantity']}
			>
				<Button
					type="button"
					variant="ghost"
					className="h-10 w-10 rounded-l-2xl"
					onClick={() =>
						setQuantity((value) => Math.max(1, value - 1))
					}
					disabled={quantity <= 1 || isPending}
					aria-label={translations['cart.storefront.decrease']}
				>
					<Icons.Action.Subtract className="h-4 w-4" />
				</Button>

				<span
					className="w-10 text-center text-sm font-medium tabular-nums"
					aria-live="polite"
				>
					{quantity}
				</span>

				<Button
					type="button"
					variant="ghost"
					className="h-10 w-10 rounded-r-2xl"
					onClick={() =>
						setQuantity((value) =>
							Math.min(QUANTITY_MAX, value + 1),
						)
					}
					disabled={quantity >= QUANTITY_MAX || isPending}
					aria-label={translations['cart.storefront.increase']}
				>
					<Icons.Action.Add className="h-4 w-4" />
				</Button>
			</fieldset>

			<Button type="button" onClick={onAdd} disabled={isPending}>
				<Icons.Cart className="mr-2 h-4 w-4" />
				{isPending
					? translations['cart.storefront.adding']
					: translations['cart.storefront.add']}
			</Button>
		</div>
	);
}
