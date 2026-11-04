'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CartLineIssueEnum,
	type CartLineModel,
	type CartModel,
	displayCartOwner,
} from '@/models/cart.model';

const TRANSLATION_KEYS = [
	'cart.field.checkout',
	'cart.field.currency',
	'cart.field.discount',
	'cart.field.exchange_rate',
	'cart.field.expires_at',
	'cart.field.id',
	'cart.field.item',
	'cart.field.qty',
	'cart.field.shopper',
	'cart.field.subtotal_excl_vat',
	'cart.field.total',
	'cart.field.unit',
	'cart.field.updated_at',
	'cart.field.vat',
	'cart.section.cart',
	'cart.section.lines',
	'cart.section.pricing',
	'cart.text.bundle',
	'cart.text.prices_are_resolved_from_the_catalog',
	'cart.text.this_cart_is_empty',
	'cart.text.variant_ref',
	'cart.text.product_variant_ref',
	'cart.text.base_price',
	'cart.text.checkout_blocked',
	'cart.text.user_ref',
	'dashboard.text.guest',
	...enumTranslationKeys('cart.enum.issue', CartLineIssueEnum),
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

function money(value: number, currency: string): string {
	return `${value.toFixed(2)} ${currency}`;
}

/**
 * One line of the basket.
 *
 * A line carrying an `issue` is dimmed and labelled rather than hidden: it is still in the
 * shopper's cart and still blocking their checkout, so a support screen that quietly dropped it
 * would be answering a question about a cart nobody has.
 *
 * A bundle's component lines follow their header and are indented under it, the way the order view
 * draws them: the header carries no money and the components carry all of it.
 */
function CartLineRow({
	translations,
	line,
	currency,
}: {
	translations: TranslationsType;
	readonly line: CartLineModel;
	readonly currency: string;
}) {
	return (
		<tr className={line.issue ? 'opacity-60' : undefined}>
			<td
				className={
					line.parent_id
						? 'py-2 pr-4 pl-4 align-top'
						: 'py-2 pr-4 align-top'
				}
			>
				<div className="font-medium">
					{line.label ??
						line.sku ??
						replaceVars(translations['cart.text.variant_ref'], {
							id: line.variant_id,
						})}
					{line.is_bundle && (
						<span className="ml-2 text-xs font-normal text-muted">
							{translations['cart.text.bundle']}
						</span>
					)}
				</div>
				<div className="text-xs text-muted">
					{line.sku && `${line.sku} · `}
					{replaceVars(
						translations['cart.text.product_variant_ref'],
						{
							product: line.product_id,
							variant: line.variant_id,
						},
					)}
				</div>

				{line.options.length > 0 && (
					<ul className="mt-1 text-xs text-muted">
						{line.options.map((option) => (
							<li key={`${line.id}-${option.label}`}>
								+ {option.label}
								{option.price_delta !== 0 &&
									` (${option.price_delta > 0 ? '+' : ''}${money(option.price_delta, option.currency)})`}
							</li>
						))}
					</ul>
				)}

				{line.notes && (
					<div className="mt-1 text-xs italic text-muted">
						“{line.notes}”
					</div>
				)}

				{line.issue && (
					<div className="mt-1 text-xs font-medium text-danger">
						{translateEnumLabel(
							translations,
							'cart.enum.issue',
							line.issue,
						)}
					</div>
				)}
			</td>
			<td className="py-2 pr-4 text-right align-top">{line.quantity}</td>
			<td className="py-2 pr-4 text-right align-top">
				{/* The unit price with the options already folded in; `base_price` is what the
				    catalog charges before them. */}
				{money(line.unit_price, currency)}
				{line.base_price !== line.unit_price && (
					<div className="text-xs text-muted">
						{replaceVars(translations['cart.text.base_price'], {
							price: money(line.base_price, currency),
						})}
					</div>
				)}
			</td>
			<td className="py-2 pr-4 text-right align-top">{line.vat_rate}%</td>
			<td className="py-2 pr-4 text-right align-top">
				{line.discount_reduction > 0 ? (
					<>
						-{money(line.discount_reduction, currency)}
						{/* One per rule: a line can carry its own discount and an order-wide
						    campaign's share of it at the same time, and the figure above is
						    their sum. */}
						{line.discount?.map((discount, index) => (
							<div
								key={discount.discount_id ?? index}
								className="text-xs text-muted"
							>
								{discount.label}
							</div>
						))}
					</>
				) : (
					'-'
				)}
			</td>
			<td className="py-2 text-right align-top font-medium">
				{money(line.total, currency)}
			</td>
		</tr>
	);
}

export function ViewCart({ entry }: { entry: CartModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const pricing = entry.pricing;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['cart.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['cart.section.cart']}>
				<ViewField
					label={translations['cart.field.shopper']}
					value={displayCartOwner(entry, {
						user: translations['cart.text.user_ref'],
						guest: translations['dashboard.text.guest'],
					})}
				/>
				<ViewField
					label={translations['cart.field.currency']}
					value={entry.currency}
				/>
				{/* The deadline the cleanup job measures against - a cart untouched past it is
				    deleted, lines and all. */}
				<ViewField
					label={translations['cart.field.expires_at']}
					value={formatDate(entry.expires_at, 'date-time')}
				/>
				<ViewField
					label={translations['cart.field.updated_at']}
					value={
						entry.updated_at
							? formatDate(entry.updated_at, 'date-time')
							: '-'
					}
				/>
			</ViewSection>

			{/*
			 * The token is deliberately absent from this window. It is the guest's whole
			 * credential - anybody holding it can read and empty that cart - so it is not
			 * something a support screen puts on screen to be read over a shoulder or pasted
			 * into a ticket.
			 */}

			<ViewSection
				title={translations['cart.section.lines']}
				layout="rows"
			>
				{!pricing || pricing.lines.length === 0 ? (
					<p className="text-sm text-muted">
						{translations['cart.text.this_cart_is_empty']}
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
									<th className="py-2 pr-4 text-left font-medium">
										{translations['cart.field.item']}
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										{translations['cart.field.qty']}
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										{translations['cart.field.unit']}
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										{translations['cart.field.vat']}
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										{translations['cart.field.discount']}
									</th>
									<th className="py-2 text-right font-medium">
										{translations['cart.field.total']}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{pricing.lines.map((line) => (
									<CartLineRow
										translations={translations}
										key={line.id}
										line={line}
										currency={pricing.currency}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</ViewSection>

			{pricing && (
				<ViewSection title={translations['cart.section.pricing']}>
					<ViewField
						label={translations['cart.field.subtotal_excl_vat']}
						value={money(pricing.subtotal, pricing.currency)}
					/>
					<ViewField
						label={translations['cart.field.discount']}
						value={
							pricing.discount_reduction > 0
								? `-${money(pricing.discount_reduction, pricing.currency)}`
								: '-'
						}
					/>
					<ViewField
						label={translations['cart.field.vat']}
						value={money(pricing.vat_amount, pricing.currency)}
					/>
					<ViewField
						label={translations['cart.field.total']}
						value={money(pricing.total, pricing.currency)}
					/>
					{/*
					 * Shown only when it is not 1, which is the ordinary case. The rate converts
					 * the sale currency to the books' base currency and is what an `amount`
					 * discount and a minimum-basket condition are measured through.
					 */}
					{pricing.exchange_rate !== 1 && (
						<ViewField
							label={translations['cart.field.exchange_rate']}
							value={pricing.exchange_rate}
						/>
					)}
					{pricing.has_issues && (
						<ViewField
							label={translations['cart.field.checkout']}
							value={translations['cart.text.checkout_blocked']}
							full
						/>
					)}
				</ViewSection>
			)}

			{/*
			 * Stated rather than assumed: everything above is worked out against the catalog at
			 * the moment this window was opened, and none of it is stored on the cart. A reader
			 * comparing it to what the shopper saw last week should know why the numbers differ.
			 */}
			<p className="text-xs text-muted">
				{translations['cart.text.prices_are_resolved_from_the_catalog']}
			</p>
		</div>
	);
}
