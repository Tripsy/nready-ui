'use client';

import NextLink from 'next/link';
import type { JSX } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { useCart } from '@/hooks/use-cart.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CartLineIssueEnum,
	type CartLineModel,
	cartLineHref,
	displayCartLineName,
	getCartDiscountGross,
	getCartLineGrossTotal,
	getCartLineGrossUnitPrice,
	groupCartComponents,
} from '@/models/cart.model';
import { roundMoney } from '@/models/product.model';
import { useAuth } from '@/providers/auth.provider';
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
	'cart.storefront.products_cost',
	'cart.storefront.discount',
	'cart.storefront.delivery_cost',
	'cart.storefront.vat_included',
	'cart.storefront.total',
	'cart.storefront.go_to_checkout',
	'cart.storefront.continue_shopping',
	'cart.storefront.has_issues',
	'cart.storefront.unavailable',
	'cart.storefront.bundle_changed',
	'cart.storefront.checkout_sign_in_hint',
] as const;

const QUANTITY_MAX = 999;

function money(value: number, currency: string): string {
	return `${value.toFixed(2)} ${currency}`;
}

/**
 * Delivery is not priced anywhere yet - no shipping method or rate exists to charge from - so the
 * summary states it as zero rather than leaving out a line the shopper will expect to see.
 */
const DELIVERY_COST = 0;

/** The line's name, linked to its product page when the product has a slug to link to. */
function LineName({ line }: { readonly line: CartLineModel }) {
	const href = cartLineHref(line);

	if (!href) {
		return <>{displayCartLineName(line)}</>;
	}

	return (
		<NextLink href={href} className="hover:underline underline-offset-4">
			{displayCartLineName(line)}
		</NextLink>
	);
}

type Translations = Record<(typeof TRANSLATION_KEYS)[number], string>;

function BasketLine({
	line,
	components,
	currency,
	translations,
	isBusy,
	onQuantity,
	onRemove,
}: {
	readonly line: CartLineModel;
	/** A bundle's component lines; empty on every other line. */
	readonly components: CartLineModel[];
	readonly currency: string;
	readonly translations: Translations;
	readonly isBusy: boolean;
	readonly onQuantity: (quantity: number) => void;
	readonly onRemove: () => void;
}) {
	// Quoted VAT-inclusive; a bundle's figure is summed from its components (see the helper)
	const total = getCartLineGrossTotal(line, components);
	const unitPrice = getCartLineGrossUnitPrice(line, total);

	// A broken component breaks the bundle: it is bought whole or not at all.
	const issue =
		line.issue ?? components.find((component) => component.issue)?.issue;

	return (
		<li className="flex flex-wrap items-start justify-between gap-4 py-4">
			<div className="min-w-0 flex-1">
				<p className="font-medium">
					<LineName line={line} />
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

				{/*
				 * What the bundle holds, without controls: the components were settled when it was
				 * added and the backend refuses editing or removing one on its own. Their quantity
				 * is per bundle, so it is shown only when a bundle holds more than one of it.
				 */}
				{components.length > 0 && (
					<ul className="mt-1 text-sm text-muted">
						{components.map((component) => (
							<li key={component.id}>
								{component.quantity !== 1 && (
									<span className="tabular-nums">
										{component.quantity} ×{' '}
									</span>
								)}
								<LineName line={component} />
							</li>
						))}
					</ul>
				)}

				<p className="mt-1 text-sm text-muted">
					{money(unitPrice, currency)}
					{line.discount && (
						<span className="ml-2 text-accent">
							{line.discount.label}
						</span>
					)}
				</p>

				{/* Shown, never hidden: this is what is blocking checkout, so it has to be
				    visible next to the control that removes it. */}
				{issue && (
					<p className="mt-1 text-sm font-medium text-danger">
						{issue === CartLineIssueEnum.BUNDLE_CHANGED
							? translations['cart.storefront.bundle_changed']
							: translations['cart.storefront.unavailable']}
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
					{money(total, currency)}
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
 *
 * A bundle arrives as a header line followed by its components, linked by `parent_id`. Only the
 * header is a row here - changing its quantity or removing it carries the components along on
 * the backend.
 */
export function CartBasket(): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { showToast } = useToast();
	const { auth } = useAuth();
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
			<div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
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

	/*
	 * The summary is VAT-inclusive throughout. The products cost is derived from the total rather
	 * than summed separately, so the three lines always reconcile to the total the backend computed.
	 */
	const discountGross = getCartDiscountGross(pricing.lines);
	const productsCost = roundMoney(
		pricing.total + discountGross - DELIVERY_COST,
	);

	const componentsByParent = groupCartComponents(lines);

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
			{/* The same card the product page's buy box sits in, so the storefront reads as one surface */}
			<div className="h-fit rounded-2xl border border-border bg-surface px-6 py-2">
				<ul className="divide-y divide-border">
					{lines
						.filter((line) => line.parent_id === null)
						.map((line) => (
							<BasketLine
								key={line.id}
								line={line}
								components={
									componentsByParent.get(line.id) ?? []
								}
								currency={pricing.currency}
								translations={translations}
								isBusy={isBusy}
								onQuantity={(quantity) =>
									onQuantity(line.id, quantity)
								}
								onRemove={() => onRemove(line.id)}
							/>
						))}
				</ul>
			</div>

			<aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24">
				<dl className="space-y-2 text-sm">
					<div className="flex justify-between text-muted">
						<dt>{translations['cart.storefront.products_cost']}</dt>
						<dd className="tabular-nums">
							{money(productsCost, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between text-muted">
						<dt>{translations['cart.storefront.discount']}</dt>
						<dd className="tabular-nums">
							{discountGross > 0 ? '-' : ''}
							{money(discountGross, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between text-muted">
						<dt>{translations['cart.storefront.delivery_cost']}</dt>
						<dd className="tabular-nums">
							{money(DELIVERY_COST, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
						<dt>{translations['cart.storefront.total']}</dt>
						<dd className="tabular-nums">
							{money(pricing.total, pricing.currency)}
						</dd>
					</div>

					<p className="text-right text-xs text-muted">
						{translations['cart.storefront.vat_included']}{' '}
						{money(pricing.vat_amount, pricing.currency)}
					</p>
				</dl>

				{pricing.has_issues && (
					<p className="mt-4 text-sm font-medium text-danger">
						{translations['cart.storefront.has_issues']}
					</p>
				)}

				{/*
				 * A link for a guest too: `/checkout` is authenticated, so the middleware sends
				 * them to login with `?from=/checkout`, and signing in folds this guest cart into
				 * the account's. Disabled while a line carries an issue, which the backend would
				 * refuse at checkout anyway.
				 */}
				{pricing.has_issues ? (
					<Button type="button" className="mt-5 w-full" disabled>
						{translations['cart.storefront.go_to_checkout']}
					</Button>
				) : (
					<NextLink
						href={Routes.get('checkout')}
						className="mt-5 flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
					>
						{translations['cart.storefront.go_to_checkout']}
					</NextLink>
				)}

				{!auth && (
					<p className="mt-2 text-xs text-muted">
						{translations['cart.storefront.checkout_sign_in_hint']}
					</p>
				)}

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
