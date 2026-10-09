'use client';

import { useMemo, useState } from 'react';
import type { ProductOptionsBuilderTranslations } from '@/app/(public)/_components/product/product-options-builder.definition';
import { AddToCart } from '@/components/cart/add-to-cart.component';
import { Checkbox } from '@/components/ui/checkbox';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { replaceVars } from '@/helpers/string.helper';
import {
	formatProductPrice,
	type ProductOptionGroupType,
	type ProductOptionType,
	type ProductTermRefType,
	roundMoney,
} from '@/models/product.model';
import type { Language } from '@/types/common.type';

/** An option as the storefront read hands it back - `id` is always present there. */
type PublicOption = ProductOptionType & { id: number };
type PublicGroup = Omit<ProductOptionGroupType, 'options'> & {
	id: number;
	options: PublicOption[];
};

function resolveLabel(
	term: ProductTermRefType | null | undefined,
	language: Language,
): string {
	const contents = term?.contents ?? [];

	return (
		contents.find((content) => content.language === language)?.value ??
		contents[0]?.value ??
		''
	);
}

/** The signed delta one answer adds to the unit price in `currency`, excluding VAT; 0 when unpriced there. */
function resolveDelta(option: PublicOption, currency: string): number {
	return Number(
		option.prices.find((price) => price.currency === currency)
			?.price_delta ?? 0,
	);
}

/**
 * Whether a group's answers sit inside its bounds. Mirrors `ProductOptionSelectionService.findProblem`
 * on the backend, which has the last word; this only keeps the add disabled until it would pass.
 */
function isAnswered(group: PublicGroup, picked: ReadonlySet<number>): boolean {
	const count = group.options.filter((option) =>
		picked.has(option.id),
	).length;

	return (
		count >= (group.min_select ?? 0) &&
		(group.max_select === null || count <= group.max_select)
	);
}

/**
 * The questions a simple product asks at order time, on the product page, with the add under them.
 *
 * A group taking exactly one answer is a radio set - there is nothing to untick. Every other shape
 * is tick boxes: one capped at a single answer swaps the tick rather than refusing the second, and
 * one with a higher cap disables the rest once it is reached, so the shopper is never shown a
 * choice the backend would refuse. `is_default` answers start ticked; a required group with no
 * default starts unanswered and holds the add disabled, since preselecting would choose for them.
 *
 * The price is quoted the way `CartPricingService` charges a line: the deltas folded into the net
 * unit price, rounded, then taxed at the product's own rate and rounded again. Taxing each delta
 * on its own would land a cent away. It is shown only when some answer moves the price at all.
 */
export function ProductOptionsBuilder({
	productId,
	variantId,
	isAvailable,
	price,
	vatRate,
	groups,
	language,
	translations,
}: {
	readonly productId: number;
	readonly variantId: number;
	readonly isAvailable: boolean;
	/** The selected variant's price, excluding VAT, in the market the page quotes; `null` when it has none. */
	readonly price: { currency: string; net_sale_price: number } | null;
	/** The product's own rate in percent; without it no VAT-inclusive figure can be quoted. */
	readonly vatRate: number | undefined;
	readonly groups: ProductOptionGroupType[];
	readonly language: Language;
	readonly translations: ProductOptionsBuilderTranslations;
}) {
	const sortedGroups = useMemo(
		() =>
			groups
				.filter((group): group is PublicGroup => group.id !== undefined)
				.map((group) => ({
					...group,
					options: group.options
						.filter(
							(option): option is PublicOption =>
								option.id !== undefined,
						)
						.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
				}))
				.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
		[groups],
	);

	const [picked, setPicked] = useState<ReadonlySet<number>>(
		() =>
			new Set(
				sortedGroups.flatMap((group) =>
					group.options
						.filter((option) => option.is_default)
						.map((option) => option.id),
				),
			),
	);

	const currency = price?.currency;

	const gross = (net: number) =>
		vatRate === undefined
			? null
			: roundMoney(net + roundMoney((net * vatRate) / 100));

	const isComplete = sortedGroups.every((group) => isAnswered(group, picked));

	const movesPrice =
		currency !== undefined &&
		sortedGroups.some((group) =>
			group.options.some(
				(option) => resolveDelta(option, currency) !== 0,
			),
		);

	const total =
		price && currency && movesPrice
			? gross(
					roundMoney(
						price.net_sale_price +
							sortedGroups
								.flatMap((group) => group.options)
								.filter((option) => picked.has(option.id))
								.reduce(
									(sum, option) =>
										sum + resolveDelta(option, currency),
									0,
								),
					),
				)
			: null;

	const toggle = (group: PublicGroup, optionId: number, checked: boolean) =>
		setPicked((current) => {
			const next = new Set(current);

			if (!checked) {
				next.delete(optionId);

				return next;
			}

			// A single-answer group swaps the tick instead of holding two
			if (group.max_select === 1) {
				for (const option of group.options) {
					next.delete(option.id);
				}
			}

			next.add(optionId);

			return next;
		});

	const hint = (group: PublicGroup): string | null => {
		const min = group.min_select ?? 0;
		const max = group.max_select;
		const vars = { min: min, max: max ?? '' };

		if (min === 1 && max === 1) {
			return null;
		}

		if (min === 0 && (max === null || max >= group.options.length)) {
			return translations['text.options_optional'];
		}

		if (max === null) {
			return replaceVars(
				translations['text.options_choose_at_least'],
				vars,
			);
		}

		if (min === max) {
			return replaceVars(
				translations['text.options_choose_exactly'],
				vars,
			);
		}

		if (min === 0) {
			return replaceVars(
				translations['text.options_choose_at_most'],
				vars,
			);
		}

		return replaceVars(translations['text.options_choose_between'], vars);
	};

	const renderDelta = (option: PublicOption) => {
		if (!currency) {
			return null;
		}

		const delta = resolveDelta(option, currency);
		const quoted = delta === 0 ? null : gross(delta);

		if (quoted === null) {
			return null;
		}

		// The delta with the product's VAT - what the total moves by, to the cent or one off it,
		// since the total rounds once over the whole unit price
		return (
			<span className="ml-auto shrink-0 text-sm text-muted tabular-nums">
				{`${quoted > 0 ? '+' : ''}${formatProductPrice(quoted, currency, language)}`}
			</span>
		);
	};

	return (
		<div>
			{sortedGroups.map((group) => {
				const label = resolveLabel(group.label, language);
				const groupHint = hint(group);
				const isSingle =
					group.min_select === 1 && group.max_select === 1;
				const count = group.options.filter((option) =>
					picked.has(option.id),
				).length;
				const isFull =
					group.max_select !== null &&
					group.max_select > 1 &&
					count >= group.max_select;

				return (
					<div key={group.id} className="mt-4">
						<h3
							id={`option-group-${group.id}`}
							className="text-xs uppercase tracking-wide text-muted"
						>
							{label}
							{groupHint && (
								<span className="ml-2 normal-case tracking-normal">
									{groupHint}
								</span>
							)}
						</h3>

						{isSingle ? (
							<RadioGroup
								aria-labelledby={`option-group-${group.id}`}
								className="mt-2 flex flex-col gap-2"
								value={
									group.options
										.find((option) => picked.has(option.id))
										?.id.toString() ?? null
								}
								onChange={(value: string) =>
									toggle(group, Number(value), true)
								}
							>
								{group.options.map((option) => (
									<Radio
										key={option.id}
										value={String(option.id)}
										contentClassName="flex w-full items-center gap-2 text-sm"
									>
										<span>
											{resolveLabel(
												option.label,
												language,
											)}
										</span>
										{renderDelta(option)}
									</Radio>
								))}
							</RadioGroup>
						) : (
							<fieldset
								aria-labelledby={`option-group-${group.id}`}
								className="mt-2 flex flex-col gap-2"
							>
								{group.options.map((option) => {
									const isTaken = picked.has(option.id);

									return (
										<div
											key={option.id}
											className="flex items-center gap-2"
										>
											<Checkbox
												id={`option-${option.id}`}
												isSelected={isTaken}
												isDisabled={isFull && !isTaken}
												onChange={(checked: boolean) =>
													toggle(
														group,
														option.id,
														checked,
													)
												}
												contentClassName="flex items-center gap-2 text-sm"
											>
												{resolveLabel(
													option.label,
													language,
												)}
											</Checkbox>
											{renderDelta(option)}
										</div>
									);
								})}
							</fieldset>
						)}
					</div>
				);
			})}

			{total !== null && currency && (
				<p className="mt-6 flex items-baseline justify-between gap-2 border-t border-border pt-4">
					<span className="text-sm text-muted">
						{translations['text.options_price']}
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
				options={[...picked]}
				isReady={isComplete}
			/>
		</div>
	);
}
