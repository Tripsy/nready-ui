'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import {
	displayShippingDestination,
	displayShippingDocument,
	displayShippingEnd,
	type ShippingModel,
} from '@/models/shipping.model';

/** What `operational_cost` is kept in, whatever currency the client is billed in. */
const BASE_CURRENCY = Configuration.get('app.currency');

export function ViewShipping({ entry }: { entry: ShippingModel }) {
	const lines = entry.lines ?? [];

	const pickup = displayShippingEnd(
		entry.pickup_data,
		entry.pickup_warehouse,
		entry.pickup_client_address_id,
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="shipping"
					/>
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Movement type"
					value={formatEnumLabel(entry.scope)}
				/>
				<ViewField
					label="Document"
					value={displayShippingDocument(entry)}
				/>
				<ViewField
					label="Method"
					value={formatEnumLabel(entry.method)}
				/>
				<ViewField label="Carrier" value={entry.carrier?.name ?? '-'} />
				<ViewField
					label="Tracking Number"
					value={entry.tracking_number ?? '-'}
				/>
				<ViewField
					label="Tracking URL"
					value={entry.tracking_url ?? '-'}
				/>
			</ViewSection>

			{/*
			 * Both ends are frozen when the movement is marked shipped, so before that this reports
			 * the live reference instead - the two can legitimately differ while it is still being
			 * prepared, and the live one is what a correction would reach.
			 */}
			<ViewSection title="Route">
				<ViewField label="From" value={pickup} />
				<ViewField
					label="To"
					value={displayShippingDestination(entry)}
				/>
				<ViewField
					label="Frozen"
					value={
						entry.pickup_data || entry.destination_data
							? 'Yes, on dispatch'
							: 'Not yet'
					}
				/>
				<ViewField label="Contact" value={entry.contact_name ?? '-'} />
				<ViewField label="Phone" value={entry.contact_phone ?? '-'} />
				<ViewField label="Email" value={entry.contact_email ?? '-'} />
			</ViewSection>

			<ViewSection title="Cost">
				<ViewField
					label="Price"
					value={`${Number(entry.price).toFixed(2)} ${entry.currency}`}
				/>
				{Number(entry.discount_reduction ?? 0) > 0 && (
					<ViewField
						label="Discount"
						value={`-${Number(entry.discount_reduction).toFixed(2)} ${entry.currency}${
							entry.discount?.[0]
								? ` (${entry.discount[0].label})`
								: ''
						}`}
					/>
				)}
				<ViewField
					label="VAT Rate"
					value={`${Number(entry.vat_rate).toFixed(2)}%`}
				/>
				{/* Base currency, not the client's - see `ShippingModel.operational_cost` */}
				<ViewField
					label="Operational Cost"
					value={
						typeof entry.operational_cost === 'number'
							? `${entry.operational_cost.toFixed(2)} ${BASE_CURRENCY}`
							: 'Not recorded'
					}
				/>
			</ViewSection>

			<ViewSection title="Lines" layout="rows">
				{lines.length === 0 ? (
					<p className="text-sm text-muted">
						This movement carries no lines.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
									<th className="py-2 pr-4 text-left font-medium">
										Item
									</th>
									<th className="py-2 text-right font-medium">
										Qty
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{lines.map((line) => (
									<tr key={line.id}>
										<td className="py-2 pr-4 align-top">
											<div className="font-medium">
												{line.label ??
													line.sku ??
													`Variant #${line.variant_id}`}
											</div>
											<div className="text-xs text-muted">
												{line.sku && `${line.sku} · `}
												Product #{line.product_id} ·
												Variant #{line.variant_id}
											</div>
											{line.notes && (
												<div className="mt-1 text-xs italic text-muted">
													“{line.notes}”
												</div>
											)}
										</td>
										<td className="py-2 text-right align-top">
											{Number(line.quantity)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</ViewSection>

			<ViewSection title="Dates">
				<ViewField
					label="Estimated Delivery"
					value={
						entry.estimated_delivery_at
							? formatDate(entry.estimated_delivery_at)
							: '-'
					}
				/>
				<ViewField
					label="Shipped At"
					value={
						entry.shipped_at
							? formatDate(entry.shipped_at, 'date-time')
							: '-'
					}
				/>
				<ViewField
					label="Delivered At"
					value={
						entry.delivered_at
							? formatDate(entry.delivered_at, 'date-time')
							: '-'
					}
				/>
			</ViewSection>

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
