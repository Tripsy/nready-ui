'use client';

import NextLink from 'next/link';
import { type JSX, useEffect, useRef, useState } from 'react';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';
import { useCart } from '@/hooks/use-cart.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CartLineModel } from '@/models/cart.model';

const TRANSLATION_KEYS = [
	'cart.storefront.heading',
	'cart.storefront.empty',
	'cart.storefront.empty_hint',
	'cart.storefront.open',
	'cart.storefront.subtotal',
	'cart.storefront.discount',
	'cart.storefront.vat',
	'cart.storefront.total',
	'cart.storefront.go_to_checkout',
	'cart.storefront.has_issues',
	'cart.storefront.loading',
	'cart.storefront.unavailable',
] as const;

/** How many lines the panel shows before it stops; the cart page is where the rest live. */
const PREVIEW_LINES = 4;

/**
 * The delay before a hover closes the panel.
 *
 * Without it the panel disappears the moment the pointer leaves the icon, which is exactly what
 * happens on the way *into* the panel - the gap between the trigger and the panel below it. The
 * delay is what makes the two behave as one target.
 */
const CLOSE_DELAY_MS = 200;

function money(value: number, currency: string): string {
	return `${value.toFixed(2)} ${currency}`;
}

function CartMenuLine({
	line,
	currency,
	unavailableLabel,
}: {
	readonly line: CartLineModel;
	readonly currency: string;
	readonly unavailableLabel: string;
}) {
	return (
		<li className="flex items-start justify-between gap-3 py-2">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">
					{line.sku ?? `#${line.variant_id}`}
				</p>
				<p className="text-xs text-muted">
					{line.quantity} × {money(line.unit_price, currency)}
				</p>
				{/* A line that cannot be bought is shown and labelled, never hidden - it is what
				    is blocking their checkout, so it has to be findable. */}
				{line.issue && (
					<p className="text-xs font-medium text-danger">
						{unavailableLabel}
					</p>
				)}
			</div>

			<span className="shrink-0 text-sm tabular-nums">
				{money(line.total, currency)}
			</span>
		</li>
	);
}

/**
 * The cart in the header: an icon with a count, and a panel of what is in it.
 *
 * Opens on hover *and* on click, deliberately. Hover is what a pointer expects, but it does not
 * exist on a touch screen and is not reachable from a keyboard - so the trigger is a real button
 * that toggles the same panel, and the hover handlers only add a shortcut on top of it.
 *
 * It renders nothing at all until there is something to show. A cart is created by the first read,
 * so an empty icon would appear for every visitor who has never added anything - and the panel
 * would have nothing to say.
 */
export function CartMenu(): JSX.Element | null {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { cart, lines, itemCount, isLoading } = useCart();

	const [isOpen, setIsOpen] = useState(false);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const cancelClose = () => {
		if (closeTimer.current) {
			clearTimeout(closeTimer.current);
			closeTimer.current = null;
		}
	};

	const scheduleClose = () => {
		cancelClose();

		closeTimer.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
	};

	// A click anywhere else closes it, which a hover-only panel would never do once it had been
	// opened by the button.
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const onPointerDown = (event: PointerEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsOpen(false);
			}
		};

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [isOpen]);

	// Written against the ref rather than calling `cancelClose`, which is a new function every
	// render and would put a changing dependency on an unmount-only effect.
	useEffect(
		() => () => {
			if (closeTimer.current) {
				clearTimeout(closeTimer.current);
			}
		},
		[],
	);

	// Nothing to show, and nothing worth drawing an empty icon for.
	if (isLoading || !cart || itemCount === 0) {
		return null;
	}

	const pricing = cart.pricing;
	const preview = lines.slice(0, PREVIEW_LINES);
	const hidden = lines.length - preview.length;

	return (
		/*
		 * biome-ignore lint/a11y/noStaticElementInteractions: the wrapper is a hover *region*
		 * around a real button and the panel it opens, not a control of its own - the button
		 * below carries the semantics, the keyboard path and the aria state. Giving this div a
		 * role would announce a grouping that does not exist, and the hover handlers are a
		 * pointer-only shortcut on top of a click that already works without them.
		 */
		<div
			ref={containerRef}
			className="relative"
			onMouseEnter={() => {
				cancelClose();
				setIsOpen(true);
			}}
			onMouseLeave={scheduleClose}
		>
			<Button
				type="button"
				variant="ghost"
				className="relative h-10 w-10"
				onClick={() => setIsOpen((open) => !open)}
				aria-label={translations['cart.storefront.open']}
				aria-expanded={isOpen}
				aria-haspopup="true"
			>
				<Icons.Cart className="h-5 w-5" />

				<span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-accent-foreground tabular-nums">
					{itemCount}
				</span>
			</Button>

			{isOpen && (
				<div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-2xl border border-border bg-background p-4 shadow-lg animate-fade-in">
					<p className="mb-2 text-sm font-semibold">
						{translations['cart.storefront.heading']}
					</p>

					<ul className="divide-y divide-border">
						{preview.map((line) => (
							<CartMenuLine
								key={line.id}
								line={line}
								currency={pricing.currency}
								unavailableLabel={
									translations['cart.storefront.unavailable']
								}
							/>
						))}
					</ul>

					{hidden > 0 && (
						<p className="pt-2 text-xs text-muted">+{hidden}</p>
					)}

					<dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
						<div className="flex justify-between text-muted">
							<dt>{translations['cart.storefront.subtotal']}</dt>
							<dd className="tabular-nums">
								{money(pricing.subtotal, pricing.currency)}
							</dd>
						</div>

						{/* Only when there is one - a zero line reads as "no discount applies",
						    which is a claim the panel does not need to make. */}
						{pricing.discount_reduction > 0 && (
							<div className="flex justify-between text-muted">
								<dt>
									{translations['cart.storefront.discount']}
								</dt>
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

						<div className="flex justify-between font-semibold">
							<dt>{translations['cart.storefront.total']}</dt>
							<dd className="tabular-nums">
								{money(pricing.total, pricing.currency)}
							</dd>
						</div>
					</dl>

					{pricing.has_issues && (
						<p className="mt-3 text-xs font-medium text-danger">
							{translations['cart.storefront.has_issues']}
						</p>
					)}

					<NextLink
						href={Routes.get('cart-view')}
						onClick={() => setIsOpen(false)}
						className={cn(
							'mt-4 flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover',
						)}
					>
						{translations['cart.storefront.go_to_checkout']}
					</NextLink>
				</div>
			)}
		</div>
	);
}
