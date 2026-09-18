'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	displayOrderClient,
	displayOrderMoney,
	displayOrderReference,
	type OrderLineModel,
	type OrderModel,
} from '@/models/order.model';

/**
 * One line of the document.
 *
 * A component line - one a bundle exploded into - is indented under its header rather than listed
 * beside it: the header carries no money and the children carry all of it, so a flat list reads as
 * a zero-priced item followed by things nobody ordered.
 */
function OrderLineRow({
	line,
	currency,
}: {
	readonly line: OrderLineModel;
	readonly currency: string;
}) {
	const gross = line.price * line.quantity;
	const net = gross - line.discount_reduction;

	return (
		<tr>
			<td className="py-2 pr-4 align-top">
				<div
					className={
						line.parent_id ? 'pl-4 font-medium' : 'font-medium'
					}
				>
					{line.label ??
						line.variant?.sku ??
						`Variant #${line.variant_id}`}
				</div>
				<div
					className={
						line.parent_id
							? 'pl-4 text-xs text-muted'
							: 'text-xs text-muted'
					}
				>
					{line.variant?.sku && `${line.variant.sku} · `}Product #
					{line.product_id} · Variant #{line.variant_id}
				</div>

				{/*
				 * The options are the record of what moved the unit price, not an amount still
				 * to be added - `price` already has the deltas folded in.
				 */}
				{line.options && line.options.length > 0 && (
					<ul className="mt-1 text-xs text-muted">
						{line.options.map((option) => (
							<li key={`${line.id}-${option.label}`}>
								+ {option.label}
								{option.price_delta !== 0 &&
									` (${option.price_delta > 0 ? '+' : ''}${displayOrderMoney(option.price_delta, option.currency)})`}
							</li>
						))}
					</ul>
				)}

				{line.notes && (
					<div className="mt-1 text-xs italic text-muted">
						“{line.notes}”
					</div>
				)}
			</td>
			<td className="py-2 pr-4 text-right align-top">{line.quantity}</td>
			<td className="py-2 pr-4 text-right align-top">
				{displayOrderMoney(line.price, currency)}
			</td>
			<td className="py-2 pr-4 text-right align-top">{line.vat_rate}%</td>
			<td className="py-2 pr-4 text-right align-top">
				{/*
				 * The money that came off, with the rule that took it named underneath - the
				 * reduction is stored on the line, clamped when the order was raised, so the
				 * figure is read rather than replayed from the snapshot.
				 */}
				{line.discount_reduction > 0 ||
				(line.discount && line.discount.length > 0) ? (
					<>
						<div>
							-
							{displayOrderMoney(
								line.discount_reduction,
								currency,
							)}
						</div>
						{line.discount && line.discount.length > 0 && (
							<div className="text-xs text-muted">
								{line.discount
									.map((entry) => entry.label)
									.join(', ')}
							</div>
						)}
					</>
				) : (
					'-'
				)}
			</td>
			<td className="py-2 text-right align-top font-medium">
				{displayOrderMoney(net, currency)}
			</td>
		</tr>
	);
}

export function ViewOrder({ entry }: { entry: OrderModel }) {
	const lines = entry.lines ?? [];
	const totals = entry.totals;
	const currency = totals?.currency ?? lines[0]?.currency ?? '';

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{displayOrderReference(entry)}
				</span>
				<span className="text-muted">#{entry.id}</span>
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="order" />
				</div>
			</div>

			<ViewSection title="Document">
				<ViewField label="Client" value={displayOrderClient(entry)} />
				<ViewField label="Type" value={formatEnumLabel(entry.type)} />
				<ViewField
					label="Issued At"
					value={formatDate(entry.issued_at, 'date-time')}
				/>
				<ViewField
					label="Contact"
					value={entry.client?.contact_email ?? '-'}
				/>
			</ViewSection>

			<ViewSection title="Lines" layout="rows">
				{lines.length === 0 ? (
					<p className="text-sm text-muted">
						This order has no lines.
					</p>
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
										Net
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{lines.map((line) => (
									<OrderLineRow
										key={line.id}
										line={line}
										currency={currency}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</ViewSection>

			{totals && (
				<ViewSection title="Totals">
					<ViewField
						label="Subtotal (excl. VAT)"
						value={displayOrderMoney(totals.subtotal, currency)}
					/>
					{/*
					 * Shown only when there is one: a "- 0.00 RON" row on the ordinary document
					 * is a line the reader has to check before ignoring.
					 */}
					{totals.discount_reduction > 0 && (
						<ViewField
							label="Discount"
							value={`-${displayOrderMoney(totals.discount_reduction, currency)}`}
						/>
					)}
					{/*
					 * A breakdown of the row above, not a further reduction - the campaign's
					 * money is already inside it, so the figure is labelled as included.
					 */}
					{totals.order_discount_reduction > 0 && (
						<ViewField
							label="Of which order-wide"
							value={`-${displayOrderMoney(totals.order_discount_reduction, currency)} (included in the discount above)`}
						/>
					)}
					<ViewField
						label="VAT"
						value={displayOrderMoney(totals.vat_amount, currency)}
					/>
					<ViewField
						label="Total"
						value={displayOrderMoney(totals.total, currency)}
					/>
					<ViewField
						label="Exchange Rate"
						value={String(totals.exchange_rate)}
					/>
					{/*
					 * The snapshot without the money: a line raised before the reduction was
					 * stored carries a rule and a zero, and the flag is what says the charged
					 * figure was lower than the total above.
					 */}
					{totals.has_discount && totals.discount_reduction === 0 && (
						<ViewField
							label="Discounts"
							value={
								<span className="text-warning">
									One or more lines carry a discount whose
									amount was never recorded - the totals above
									are before it
								</span>
							}
						/>
					)}
				</ViewSection>
			)}

			{entry.notes && (
				<ViewSection title="Notes">
					<ViewField label="Notes" value={entry.notes} />
				</ViewSection>
			)}

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label="Deleted At"
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
