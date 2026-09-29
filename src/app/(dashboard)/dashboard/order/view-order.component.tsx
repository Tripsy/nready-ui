'use client';

import { useQuery } from '@tanstack/react-query';
import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { hasPermission } from '@/models/account.model';
import {
	displayOrderClient,
	displayOrderMoney,
	displayOrderReference,
	type OrderLineModel,
	type OrderModel,
} from '@/models/order.model';
import {
	displayShippingDestination,
	displayShippingEnd,
	getShippingGrossTotal,
	type ShippingModel,
} from '@/models/shipping.model';
import { useAuth } from '@/providers/auth.provider';

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

/**
 * One movement serving the order - a delivery, or a return coming back against it.
 *
 * Read from the shipping listing, which joins the carrier and both warehouse ends but not the
 * lines; what a movement carries is on the shipping window itself.
 */
function OrderShipment({ shipment }: { readonly shipment: ShippingModel }) {
	const { total } = getShippingGrossTotal(shipment);

	return (
		<div className="space-y-3 rounded-md border border-line p-4">
			<div className="flex items-center gap-2">
				<span className="font-semibold">
					{formatEnumLabel(shipment.scope)}
				</span>
				<span className="text-muted">#{shipment.id}</span>
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={shipment.status}
						dataSource="shipping"
					/>
				</div>
			</div>

			<ViewSection>
				<ViewField
					label="Method"
					value={formatEnumLabel(shipment.method)}
				/>
				<ViewField
					label="Carrier"
					value={shipment.carrier?.name ?? '-'}
				/>
				<ViewField
					label="Tracking"
					value={
						shipment.tracking_url ? (
							<a
								href={shipment.tracking_url}
								target="_blank"
								rel="noopener noreferrer"
								className="underline"
							>
								{shipment.tracking_number ?? 'Track'}
							</a>
						) : (
							(shipment.tracking_number ?? '-')
						)
					}
				/>
				<ViewField
					label="From"
					value={displayShippingEnd(
						shipment.pickup_data,
						shipment.pickup_warehouse,
						shipment.pickup_client_address_id,
					)}
				/>
				<ViewField
					label="To"
					value={displayShippingDestination(shipment)}
				/>
				<ViewField
					label="Price (incl. VAT)"
					value={displayOrderMoney(total, shipment.currency)}
				/>
				<ViewField
					label="Estimated Delivery"
					value={
						shipment.estimated_delivery_at
							? formatDate(
									shipment.estimated_delivery_at,
									'default',
								)
							: '-'
					}
				/>
				<ViewField
					label="Shipped At"
					value={
						shipment.shipped_at
							? formatDate(shipment.shipped_at, 'date-time')
							: '-'
					}
				/>
				<ViewField
					label="Delivered At"
					value={
						shipment.delivered_at
							? formatDate(shipment.delivered_at, 'date-time')
							: '-'
					}
				/>
			</ViewSection>
		</div>
	);
}

export function ViewOrder({ entry }: { entry: OrderModel }) {
	const lines = entry.lines ?? [];
	const totals = entry.totals;
	const currency = totals?.currency ?? lines[0]?.currency ?? '';

	const { auth } = useAuth();

	// The tab is left out rather than shown failing: the listing answers 403 without this
	const canReadShipping = hasPermission(auth, 'shipping', 'read');

	/*
	 * Fetched with the window rather than on opening the tab, so the trigger can carry the count.
	 * Oldest first - the delivery before any return raised against it.
	 */
	const {
		data: shipments,
		isLoading: isShipmentsLoading,
		isError: isShipmentsError,
	} = useQuery({
		queryKey: ['order', 'shipments', entry.id],
		queryFn: async () => {
			const response = await requestFind<ShippingModel>('shipping', {
				order_by: 'id',
				direction: 'ASC',
				filter: { order_id: entry.id },
			});

			// `requestFind` resolves to `undefined` without a payload, which TanStack Query
			// rejects as query data
			if (!response) {
				throw new Error('Could not retrieve shipments');
			}

			return response.entries;
		},
		enabled: canReadShipping,
	});

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

			<Tabs defaultSelectedKey="details" className="w-full">
				<TabsList>
					<TabsTrigger id="details">Details</TabsTrigger>
					<TabsTrigger id="lines">
						Lines
						<span className="ml-1.5 text-xs text-muted">
							{lines.length}
						</span>
					</TabsTrigger>
					{canReadShipping && (
						<TabsTrigger id="shipments">
							Shipments
							{shipments && (
								<span className="ml-1.5 text-xs text-muted">
									{shipments.length}
								</span>
							)}
						</TabsTrigger>
					)}
				</TabsList>

				<TabsContent id="details" className="space-y-6">
					<ViewSection title="Document">
						<ViewField
							label="Client"
							value={displayOrderClient(entry)}
						/>
						<ViewField
							label="Type"
							value={formatEnumLabel(entry.type)}
						/>
						<ViewField
							label="Contact"
							value={entry.client?.contact_email ?? '-'}
						/>
					</ViewSection>

					{totals && (
						<ViewSection title="Totals">
							<ViewField
								label="Subtotal (excl. VAT)"
								value={displayOrderMoney(
									totals.subtotal,
									currency,
								)}
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
								value={displayOrderMoney(
									totals.vat_amount,
									currency,
								)}
							/>
							<ViewField
								label="Total"
								value={displayOrderMoney(
									totals.total,
									currency,
								)}
							/>
							{/* Always 1 in the deployment's own currency, so it says nothing there */}
							{currency !== Configuration.currency() && (
								<ViewField
									label="Exchange Rate"
									value={String(totals.exchange_rate)}
								/>
							)}
							{/*
							 * The snapshot without the money: a line raised before the reduction was
							 * stored carries a rule and a zero, and the flag is what says the charged
							 * figure was lower than the total above.
							 */}
							{totals.has_discount &&
								totals.discount_reduction === 0 && (
									<ViewField
										label="Discounts"
										value={
											<span className="text-warning">
												One or more lines carry a
												discount whose amount was never
												recorded - the totals above are
												before it
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
										{formatDate(
											entry.deleted_at,
											'date-time',
										)}
									</span>
								}
							/>
						)}
					</ViewSection>
				</TabsContent>

				<TabsContent id="lines">
					<ViewSection layout="rows">
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
				</TabsContent>

				{canReadShipping && (
					<TabsContent id="shipments" className="space-y-4">
						{isShipmentsLoading ? (
							<p className="text-sm text-muted">
								Loading shipments...
							</p>
						) : isShipmentsError || !shipments ? (
							<p className="text-sm text-danger">
								The shipments could not be loaded.
							</p>
						) : shipments.length === 0 ? (
							<p className="text-sm text-muted">
								This order has no shipments.
							</p>
						) : (
							shipments.map((shipment) => (
								<OrderShipment
									key={shipment.id}
									shipment={shipment}
								/>
							))
						)}
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
