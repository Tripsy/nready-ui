'use client';

import { useMemo, useState } from 'react';
import type { ProductBundleBuilderTranslations } from '@/app/(public)/_components/product/product-bundle-builder.definition';
import { AddToCart } from '@/components/cart/add-to-cart.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import type { CartAddItemParams } from '@/models/cart.model';
import {
	apportion,
	formatProductPrice,
	type ProductBundleGroupType,
	type ProductBundleItemType,
	roundMoney,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

/** A component as the storefront read hands it back - `id` is always present there. */
type BundleComponent = ProductBundleItemType & { id: number };

/**
 * What taking `units` of a component adds to one bundle, in the bundle's own currency: the
 * component's standalone sale price moved by its delta, per unit - the same figure
 * `CartPricingService.buildBundle` charges. `null` when either figure is missing in that market,
 * which leaves the total unquotable rather than quietly wrong.
 */
function resolveAddition(
	item: BundleComponent,
	units: number,
	currency: string,
): number | null {
	const sale = item.variant?.prices?.find(
		(price) => price.currency === currency,
	)?.sale_price;

	if (sale === null || sale === undefined) {
		return null;
	}

	const delta =
		item.prices.find((price) => price.currency === currency)?.price_delta ??
		0;

	return (Number(sale) + Number(delta)) * units;
}

function resolveGroupLabel(
	group: ProductBundleGroupType,
	language: Language,
): string {
	const contents = group.label?.contents ?? [];

	return (
		contents.find((content) => content.language === language)?.value ??
		contents[0]?.value ??
		''
	);
}

function componentName(item: BundleComponent): string {
	return item.label ?? item.variant?.sku ?? `#${item.variant_id}`;
}

/**
 * The bundle's contents and the decisions it leaves to the shopper, on the product page.
 *
 * Three kinds of component, read the way `ProductBundleSelectionService` reads them: the kit
 * (no group, not optional) is listed and never sent; a group is a radio set taking exactly one
 * candidate; an optional component is a tick box, with a stepper up to its own `quantity` when it
 * allows more than one. Only the decisions travel in `components` - naming a kit component is
 * refused by the backend.
 *
 * The total is quoted here for the shopper's sake and nowhere else: the cart re-prices the line
 * against the live catalog, so a figure that drifts from it is corrected on the next cart read.
 *
 * A group with no `is_default` candidate starts unanswered and the add stays disabled until it
 * is answered - preselecting the first candidate would be choosing for the shopper.
 */
export function ProductBundleBuilder({
	productId,
	variantId,
	isAvailable,
	bundlePrice,
	groups,
	items,
	language,
	translations,
}: {
	readonly productId: number;
	readonly variantId: number;
	readonly isAvailable: boolean;
	/** The bundle variant's own headline price, excluding VAT; `null` when it quotes none in any market. */
	readonly bundlePrice: { currency: string; sale_price: number } | null;
	readonly groups: ProductBundleGroupType[];
	readonly items: ProductBundleItemType[];
	readonly language: Language;
	readonly translations: ProductBundleBuilderTranslations;
}) {
	const components = useMemo(
		() =>
			items
				.filter(
					(item): item is BundleComponent => item.id !== undefined,
				)
				.sort((a, b) => a.position - b.position),
		[items],
	);

	const included = components.filter(
		(item) => item.group_id === null && !item.is_optional,
	);
	const extras = components.filter(
		(item) => item.group_id === null && item.is_optional,
	);
	const sortedGroups = [...groups].sort(
		(a, b) => (a.position ?? 0) - (b.position ?? 0),
	);

	// Candidate picked per group, keyed by group id.
	const [picks, setPicks] = useState<Record<number, number | undefined>>(() =>
		Object.fromEntries(
			groups.map((group) => [
				group.id,
				components.find(
					(item) => item.group_id === group.id && item.is_default,
				)?.id,
			]),
		),
	);

	// Units taken per ticked extra; an unticked extra has no entry.
	const [extraUnits, setExtraUnits] = useState<Record<number, number>>(() =>
		Object.fromEntries(
			extras
				.filter((item) => item.is_default)
				.map((item) => [item.id, 1]),
		),
	);

	if (components.length === 0) {
		return (
			<p className="text-sm text-muted">
				{translations['text.bundle_unavailable']}
			</p>
		);
	}

	const currency = bundlePrice?.currency;

	const chosen: { item: BundleComponent; units: number }[] = [
		...sortedGroups.flatMap((group) => {
			const item = components.find(
				(candidate) => candidate.id === picks[group.id],
			);

			return item ? [{ item: item, units: item.quantity }] : [];
		}),
		...extras.flatMap((item) =>
			extraUnits[item.id] !== undefined
				? [{ item: item, units: extraUnits[item.id] }]
				: [],
		),
	];

	const isComplete = sortedGroups.every(
		(group) => picks[group.id] !== undefined,
	);

	let netTotal: number | null =
		bundlePrice && currency ? bundlePrice.sale_price : null;

	for (const { item, units } of chosen) {
		const addition =
			netTotal !== null && currency
				? resolveAddition(item, units, currency)
				: null;

		netTotal =
			addition === null || netTotal === null ? null : netTotal + addition;
	}

	/*
	 * VAT-inclusive the way `CartPricingService.buildBundle` gets there: the net total apportioned
	 * across every component taken, pro-rata by standalone price, and each share taxed at its own
	 * rate, rounded per share. Anything simpler lands a cent or two away from the cart.
	 */
	let total: number | null = null;

	if (netTotal !== null && currency) {
		const parts = [
			...included.map((item) => ({ item: item, units: item.quantity })),
			...chosen,
		];
		const shares = apportion(
			roundMoney(netTotal),
			parts.map(
				({ item, units }) =>
					Number(
						item.variant?.prices?.find(
							(price) => price.currency === currency,
						)?.sale_price ?? 0,
					) * units,
			),
		);

		total = roundMoney(
			netTotal +
				shares.reduce(
					(sum, share, index) =>
						sum +
						roundMoney(
							(share * (parts[index].item.vat_rate ?? 0)) / 100,
						),
					0,
				),
		);
	}

	const payload: CartAddItemParams['components'] = chosen.map(
		({ item, units }) =>
			item.group_id === null
				? { item_id: item.id, units: units }
				: { item_id: item.id },
	);

	const renderAddition = (item: BundleComponent, units: number) => {
		if (!currency) {
			return null;
		}

		const net = resolveAddition(item, units, currency);

		if (net === null) {
			return null;
		}

		// With the component's own VAT - close to what the total moves by, not exact, since the
		// total splits the whole bundle again rather than taxing each addition on its own.
		const addition = roundMoney(net * (1 + (item.vat_rate ?? 0) / 100));

		return (
			<span className="ml-auto shrink-0 text-sm text-muted tabular-nums">
				{addition === 0
					? translations['text.bundle_free']
					: `${addition > 0 ? '+' : ''}${formatProductPrice(addition, currency, language)}`}
			</span>
		);
	};

	return (
		<div>
			<h2 className="text-sm font-semibold">
				{translations['text.bundle_heading']}
			</h2>

			{included.length > 0 && (
				<div className="mt-4">
					<h3 className="text-xs uppercase tracking-wide text-muted">
						{translations['text.bundle_included']}
					</h3>

					<ul className="mt-2 flex flex-col gap-1 text-sm">
						{included.map((item) => (
							<li key={item.id} className="flex gap-2">
								<Icons.Status.Success className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
								<span>
									{item.quantity !== 1 && (
										<span className="tabular-nums">
											{item.quantity} ×{' '}
										</span>
									)}
									{componentName(item)}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{sortedGroups.map((group) => {
				const label = resolveGroupLabel(group, language);
				const candidates = components.filter(
					(item) => item.group_id === group.id,
				);

				return (
					<div key={group.id} className="mt-4">
						<h3
							id={`bundle-group-${group.id}`}
							className="text-xs uppercase tracking-wide text-muted"
						>
							{label}
						</h3>

						<RadioGroup
							aria-labelledby={`bundle-group-${group.id}`}
							className="mt-2 flex flex-col gap-2"
							value={
								picks[group.id] !== undefined
									? String(picks[group.id])
									: null
							}
							onChange={(value: string) =>
								setPicks((current) => ({
									...current,
									[group.id]: Number(value),
								}))
							}
						>
							{candidates.map((item) => (
								<Radio
									key={item.id}
									value={String(item.id)}
									contentClassName="flex w-full items-center gap-2 text-sm"
								>
									<span>
										{item.quantity !== 1 && (
											<span className="tabular-nums">
												{item.quantity} ×{' '}
											</span>
										)}
										{componentName(item)}
									</span>
									{renderAddition(item, item.quantity)}
								</Radio>
							))}
						</RadioGroup>
					</div>
				);
			})}

			{extras.length > 0 && (
				<div className="mt-4">
					<h3 className="text-xs uppercase tracking-wide text-muted">
						{translations['text.bundle_extras']}
					</h3>

					<div className="mt-2 flex flex-col gap-2">
						{extras.map((item) => {
							const units = extraUnits[item.id];
							const isTaken = units !== undefined;

							return (
								<div
									key={item.id}
									className="flex items-center gap-2"
								>
									<Checkbox
										id={`bundle-extra-${item.id}`}
										isSelected={isTaken}
										onChange={(checked: boolean) =>
											setExtraUnits((current) => {
												const next = { ...current };

												if (checked) {
													next[item.id] = 1;
												} else {
													delete next[item.id];
												}

												return next;
											})
										}
										contentClassName="flex items-center gap-2 text-sm"
									>
										{componentName(item)}
									</Checkbox>

									{/* A ceiling above one is a count to choose, not only a yes. */}
									{isTaken && item.quantity > 1 && (
										<span className="flex items-center gap-1 text-sm">
											<Button
												type="button"
												variant="ghost"
												className="h-7 w-7"
												disabled={units <= 1}
												onClick={() =>
													setExtraUnits(
														(current) => ({
															...current,
															[item.id]:
																units - 1,
														}),
													)
												}
											>
												<Icons.Action.Subtract className="h-3 w-3" />
											</Button>
											<span className="w-5 text-center tabular-nums">
												{units}
											</span>
											<Button
												type="button"
												variant="ghost"
												className="h-7 w-7"
												disabled={
													units >= item.quantity
												}
												onClick={() =>
													setExtraUnits(
														(current) => ({
															...current,
															[item.id]:
																units + 1,
														}),
													)
												}
											>
												<Icons.Action.Add className="h-3 w-3" />
											</Button>
										</span>
									)}

									{renderAddition(item, isTaken ? units : 1)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{total !== null && currency && (
				<p className="mt-6 flex items-baseline justify-between gap-2 border-t border-border pt-4">
					<span className="text-sm text-muted">
						{translations['text.bundle_price']}
					</span>
					<span className="text-2xl font-semibold tabular-nums">
						{formatProductPrice(total, currency, language)}
					</span>
				</p>
			)}

			<AddToCart
				productId={productId}
				variantId={variantId}
				isAvailable={isAvailable}
				components={payload}
				isReady={isComplete}
			/>
		</div>
	);
}
