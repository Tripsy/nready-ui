'use client';

import NextLink from 'next/link';
import type { JSX } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { useCart } from '@/hooks/use-cart.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CartLineModel } from '@/models/cart.model';
import { useToast } from '@/providers/toast.provider';

const TRANSLATION_KEYS = [
	'cart.storefront.empty',
	'cart.storefront.empty_hint',
	'cart.storefront.loading',
	'cart.storefront.quantity',
	'cart.storefront.increase',
	'cart.storefront.decrease',
	'cart.storefront.remove',
	'cart.storefront.remove_failed',
	'cart.storefront.update_failed',
	'cart.storefront.subtotal',
	'cart.storefront.discount',
	'cart.storefront.vat',
	'cart.storefront.total',
	'cart.storefront.go_to_checkout',
	'cart.storefront.continue_shopping',
	'cart.storefront.has_issues',
	'cart.storefront.unavailable',
	'cart.storefront.checkout_unavailable',
] as const;

const QUANTITY_MAX = 999;

function money(value: number, currency: string): string {
	return `${value.toFixed(2)} ${currency}`;
}

type Translations = Record<(typeof TRANSLATION_KEYS)[number], string>;

function BasketLine({
	line,
	currency,
	translations,
	isBusy,
	onQuantity,
	onRemove,
}: {
	readonly line: CartLineModel;
	readonly currency: string;
	readonly translations: Translations;
	readonly isBusy: boolean;
	readonly onQuantity: (quantity: number) => void;
	readonly onRemove: () => void;
}) {
	return (
		<li className="flex flex-wrap items-start justify-between gap-4 py-4">
			<div className="min-w-0 flex-1">
				<p className="font-medium">
					{line.sku ?? `#${line.variant_id}`}
				</p>

				{line.options.length > 0 && (
					<ul className="mt-1 text-sm text-muted">
						{line.options.map((option) => (
							<li key={`${line.id}-${option.label}`}>
								+ {option.label}
							</li>
						))}
					</ul>
				)}

				<p className="mt-1 text-sm text-muted">
					{money(line.unit_price, currency)}
					{line.discount && (
						<span className="ml-2 text-accent">
							{line.discount.label}
						</span>
					)}
				</p>

				{/* Shown, never hidden: this is what is blocking checkout, so it has to be
				    visible next to the control that removes it. */}
				{line.issue && (
					<p className="mt-1 text-sm font-medium text-danger">
						{translations['cart.storefront.unavailable']}
					</p>
				)}
			</div>

			<div className="flex items-center gap-3">
				<fieldset
					className="flex items-center rounded-2xl border border-border"
					aria-label={translations['cart.storefront.quantity']}
				>
					<Button
						type="button"
						variant="ghost"
						className="h-9 w-9 rounded-l-2xl"
						disabled={isBusy || line.quantity <= 1}
						onClick={() => onQuantity(line.quantity - 1)}
						aria-label={translations['cart.storefront.decrease']}
					>
						<Icons.Action.Subtract className="h-4 w-4" />
					</Button>

					<span className="w-9 text-center text-sm tabular-nums">
						{line.quantity}
					</span>

					<Button
						type="button"
						variant="ghost"
						className="h-9 w-9 rounded-r-2xl"
						disabled={isBusy || line.quantity >= QUANTITY_MAX}
						onClick={() => onQuantity(line.quantity + 1)}
						aria-label={translations['cart.storefront.increase']}
					>
						<Icons.Action.Add className="h-4 w-4" />
					</Button>
				</fieldset>

				<span className="w-24 text-right font-medium tabular-nums">
					{money(line.total, currency)}
				</span>

				<Button
					type="button"
					variant="ghost"
					hover="error"
					className="h-9 w-9"
					disabled={isBusy}
					onClick={onRemove}
					aria-label={translations['cart.storefront.remove']}
				>
					<Icons.Action.Delete className="h-4 w-4" />
				</Button>
			</div>
		</li>
	);
}

/**
 * The full basket.
 *
 * Reads the same `['cart']` cache entry the header does, so a change here moves the badge without
 * either component knowing about the other. Every mutation replaces the cache from its own
 * response, which is why the totals below re-settle in one round trip rather than two.
 */
export function CartBasket(): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { showToast } = useToast();
	const { cart, lines, isLoading, updateItem, removeItem } = useCart();

	const isBusy = updateItem.isPending || removeItem.isPending;

	if (isLoading) {
		return (
			<p className="text-muted">
				{translations['cart.storefront.loading']}
			</p>
		);
	}

	if (!cart || lines.length === 0) {
		return (
			<div className="space-y-4">
				<p className="text-muted">
					{translations['cart.storefront.empty']}
				</p>
				<p className="text-sm text-muted">
					{translations['cart.storefront.empty_hint']}
				</p>
				<NextLink
					href={Routes.get('products')}
					className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
				>
					{translations['cart.storefront.continue_shopping']}
				</NextLink>
			</div>
		);
	}

	const pricing = cart.pricing;

	const onQuantity = (id: number, quantity: number) => {
		updateItem.mutate(
			{ id, quantity },
			{
				onError: () =>
					showToast({
						severity: 'error',
						summary: translations['cart.storefront.update_failed'],
					}),
			},
		);
	};

	const onRemove = (id: number) => {
		removeItem.mutate(id, {
			onError: () =>
				showToast({
					severity: 'error',
					summary: translations['cart.storefront.remove_failed'],
				}),
		});
	};

	return (
		<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
			<ul className="divide-y divide-border">
				{lines.map((line) => (
					<BasketLine
						key={line.id}
						line={line}
						currency={pricing.currency}
						translations={translations}
						isBusy={isBusy}
						onQuantity={(quantity) => onQuantity(line.id, quantity)}
						onRemove={() => onRemove(line.id)}
					/>
				))}
			</ul>

			<aside className="h-fit rounded-2xl border border-border p-5">
				<dl className="space-y-2 text-sm">
					<div className="flex justify-between text-muted">
						<dt>{translations['cart.storefront.subtotal']}</dt>
						<dd className="tabular-nums">
							{money(pricing.subtotal, pricing.currency)}
						</dd>
					</div>

					{pricing.discount_reduction > 0 && (
						<div className="flex justify-between text-muted">
							<dt>{translations['cart.storefront.discount']}</dt>
							<dd className="tabular-nums">
								-
								{money(
									pricing.discount_reduction,
									pricing.currency,
								)}
							</dd>
						</div>
					)}

					<div className="flex justify-between text-muted">
						<dt>{translations['cart.storefront.vat']}</dt>
						<dd className="tabular-nums">
							{money(pricing.vat_amount, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
						<dt>{translations['cart.storefront.total']}</dt>
						<dd className="tabular-nums">
							{money(pricing.total, pricing.currency)}
						</dd>
					</div>
				</dl>

				{pricing.has_issues && (
					<p className="mt-4 text-sm font-medium text-danger">
						{translations['cart.storefront.has_issues']}
					</p>
				)}

				{/*
				 * Deliberately disabled, and it says why rather than failing on submit.
				 *
				 * `POST /public/cart/checkout` needs a `client_id` - an order is billed to a
				 * `client`, which is a business counterparty with no link to a user account and
				 * no storefront way to create or choose one. Wiring a button that always 422s
				 * would be worse than an honest one that does not pretend.
				 */}
				<Button
					type="button"
					className="mt-5 w-full"
					disabled
					title={translations['cart.storefront.checkout_unavailable']}
				>
					{translations['cart.storefront.go_to_checkout']}
				</Button>

				<p className="mt-2 text-xs text-muted">
					{translations['cart.storefront.checkout_unavailable']}
				</p>

				<NextLink
					href={Routes.get('products')}
					className="mt-4 block text-center text-sm text-muted underline-offset-4 hover:underline"
				>
					{translations['cart.storefront.continue_shopping']}
				</NextLink>
			</aside>
		</div>
	);
}
