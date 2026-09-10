'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	type CartLineModel,
	type CartModel,
	displayCartOwner,
} from '@/models/cart.model';

function money(value: number, currency: string): string {
	return `${value.toFixed(2)} ${currency}`;
}

/**
 * One line of the basket.
 *
 * A line carrying an `issue` is dimmed and labelled rather than hidden: it is still in the
 * shopper's cart and still blocking their checkout, so a support screen that quietly dropped it
 * would be answering a question about a cart nobody has.
 */
function CartLineRow({
	line,
	currency,
}: {
	readonly line: CartLineModel;
	readonly currency: string;
}) {
	return (
		<tr className={line.issue ? 'opacity-60' : undefined}>
			<td className="py-2 pr-4 align-top">
				<div className="font-medium">
					{line.sku ?? `Variant #${line.variant_id}`}
				</div>
				<div className="text-xs text-muted">
					Product #{line.product_id} · Variant #{line.variant_id}
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
					<div className="mt-1 text-xs font-medium text-error">
						{formatEnumLabel(line.issue)}
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
						base {money(line.base_price, currency)}
					</div>
				)}
			</td>
			<td className="py-2 pr-4 text-right align-top">{line.vat_rate}%</td>
			<td className="py-2 pr-4 text-right align-top">
				{line.discount_reduction > 0 ? (
					<>
						-{money(line.discount_reduction, currency)}
						{line.discount && (
							<div className="text-xs text-muted">
								{line.discount.label}
							</div>
						)}
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
	const pricing = entry.pricing;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Cart">
				<ViewField
					label="Status"
					value={formatEnumLabel(entry.status)}
				/>
				<ViewField label="Shopper" value={displayCartOwner(entry)} />
				<ViewField label="Currency" value={entry.currency} />
				<ViewField
					label="Order"
					value={entry.order_id ? `#${entry.order_id}` : '-'}
				/>
				{/*
				 * Only meaningful while the cart is active: it is the deadline the cleanup job
				 * measures against, and on a terminal cart it is a moment that already passed.
				 */}
				<ViewField
					label="Expires At"
					value={
						entry.status === 'active'
							? formatDate(entry.expires_at)
							: '-'
					}
				/>
				<ViewField
					label="Last Activity"
					value={
						entry.updated_at ? formatDate(entry.updated_at) : '-'
					}
				/>
			</ViewSection>

			{/*
			 * The token is deliberately absent from this window. It is the guest's whole
			 * credential - anybody holding it can read and empty that cart - so it is not
			 * something a support screen puts on screen to be read over a shoulder or pasted
			 * into a ticket.
			 */}

			<ViewSection title="Lines" layout="rows">
				{!pricing || pricing.lines.length === 0 ? (
					<p className="text-sm text-muted">This cart is empty.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
									<th className="py-2 pr-4 text-left font-medium">
										Item
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										Qty
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										Unit
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										VAT
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										Discount
									</th>
									<th className="py-2 text-right font-medium">
										Total
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{pricing.lines.map((line) => (
									<CartLineRow
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
				<ViewSection title="Pricing">
					<ViewField
						label="Subtotal (excl. VAT)"
						value={money(pricing.subtotal, pricing.currency)}
					/>
					<ViewField
						label="Discount"
						value={
							pricing.discount_reduction > 0
								? `-${money(pricing.discount_reduction, pricing.currency)}`
								: '-'
						}
					/>
					<ViewField
						label="VAT"
						value={money(pricing.vat_amount, pricing.currency)}
					/>
					<ViewField
						label="Total"
						value={money(pricing.total, pricing.currency)}
					/>
					{/*
					 * Shown only when it is not 1, which is the ordinary case. The rate converts
					 * the sale currency to the books' base currency and is what an `amount`
					 * discount and a minimum-basket condition are measured through.
					 */}
					{pricing.exchange_rate !== 1 && (
						<ViewField
							label="Exchange Rate"
							value={pricing.exchange_rate}
						/>
					)}
					{pricing.has_issues && (
						<ViewField
							label="Checkout"
							value="Blocked - some lines can no longer be bought"
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
				Prices are resolved from the catalog when this window is opened
				and are not stored on the cart - they are what these lines would
				cost right now.
			</p>
		</div>
	);
}
