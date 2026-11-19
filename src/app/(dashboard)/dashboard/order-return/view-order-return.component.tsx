'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { displayOrderReference } from '@/models/order.model';
import {
	displayOrderReturnLineLabel,
	displayOrderReturnReference,
	type OrderReturnModel,
	OrderReturnReasonEnum,
} from '@/models/order-return.model';

const TRANSLATION_KEYS = [
	'order-return.field.id',
	'order-return.field.reference',
	'order-return.field.order',
	'order-return.field.reason',
	'order-return.field.customer_notes',
	'order-return.field.response',
	'order-return.field.notes',
	'order-return.field.shipping',
	'order-return.field.shipping_status',
	'order-return.field.tracking_number',
	'order-return.field.refunds',
	'order-return.field.variant',
	'order-return.field.quantity',
	'order-return.field.decided_at',
	'order-return.field.received_at',
	'order-return.field.closed_at',
	'order-return.field.created_at',
	'order-return.field.updated_at',
	'order-return.field.deleted_at',
	'order-return.section.info',
	'order-return.section.messages',
	'order-return.section.shipment',
	'order-return.section.timestamps',
	'order-return.text.details',
	'order-return.text.lines',
	'order-return.text.no_lines',
	'order-return.text.no_shipment',
	'order-return.text.no_refunds',
	'order-return.text.lines_requested_hint',
	...enumTranslationKeys('order-return.enum.reason', OrderReturnReasonEnum),
] as const;

/**
 * A return as the back office reads it: the request, the decision, the return shipment's progress
 * and the refund drafts it raised. The lines are what was asked for - what actually arrived, and in
 * what condition, is on the return shipment itself.
 */
export function ViewOrderReturn({ entry }: { entry: OrderReturnModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const lines = entry.lines ?? [];
	const refunds = entry.reversal_invoice_ids ?? [];

	const stamp = (value: Date | string | null | undefined) =>
		value ? formatDate(value, 'date-time') : '-';

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['order-return.field.reference']}
				</span>{' '}
				{displayOrderReturnReference(entry)}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="order-return"
					/>
				</div>
			</div>

			<Tabs defaultSelectedKey="details" className="w-full">
				<TabsList>
					<TabsTrigger id="details">
						{translations['order-return.text.details']}
					</TabsTrigger>
					<TabsTrigger id="lines">
						{translations['order-return.text.lines']}
						<span className="ml-1.5 text-xs text-muted">
							{lines.length}
						</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent id="details" className="space-y-6">
					<ViewSection
						title={translations['order-return.section.info']}
					>
						<ViewField
							label={translations['order-return.field.id']}
							value={entry.id}
						/>
						<ViewField
							label={translations['order-return.field.order']}
							value={
								entry.order
									? displayOrderReference(entry.order)
									: `#${entry.order_id}`
							}
						/>
						<ViewField
							label={translations['order-return.field.reason']}
							value={translateEnumLabel(
								translations,
								'order-return.enum.reason',
								entry.reason,
							)}
						/>
						<ViewField
							label={translations['order-return.field.refunds']}
							value={
								refunds.length > 0
									? refunds.map((id) => `#${id}`).join(', ')
									: translations[
											'order-return.text.no_refunds'
										]
							}
						/>
					</ViewSection>

					<ViewSection
						title={translations['order-return.section.messages']}
					>
						<ViewField
							label={
								translations[
									'order-return.field.customer_notes'
								]
							}
							value={entry.customer_notes ?? '-'}
						/>
						<ViewField
							label={translations['order-return.field.response']}
							value={entry.response ?? '-'}
						/>
						<ViewField
							label={translations['order-return.field.notes']}
							value={entry.notes ?? '-'}
						/>
					</ViewSection>

					<ViewSection
						title={translations['order-return.section.shipment']}
					>
						{entry.shipping ? (
							<>
								<ViewField
									label={
										translations[
											'order-return.field.shipping'
										]
									}
									value={`#${entry.shipping.id}`}
								/>
								<ViewField
									label={
										translations[
											'order-return.field.shipping_status'
										]
									}
									value={
										<DisplayStatus
											status={entry.shipping.status}
											dataSource="shipping"
										/>
									}
								/>
								<ViewField
									label={
										translations[
											'order-return.field.tracking_number'
										]
									}
									value={
										entry.shipping.tracking_number ?? '-'
									}
								/>
							</>
						) : (
							<p className="text-sm text-muted">
								{translations['order-return.text.no_shipment']}
							</p>
						)}
					</ViewSection>

					<ViewSection
						title={translations['order-return.section.timestamps']}
					>
						<ViewField
							label={
								translations['order-return.field.created_at']
							}
							value={stamp(entry.created_at)}
						/>
						<ViewField
							label={
								translations['order-return.field.decided_at']
							}
							value={stamp(entry.decided_at)}
						/>
						<ViewField
							label={
								translations['order-return.field.received_at']
							}
							value={stamp(entry.received_at)}
						/>
						<ViewField
							label={translations['order-return.field.closed_at']}
							value={stamp(entry.closed_at)}
						/>
						<ViewField
							label={
								translations['order-return.field.updated_at']
							}
							value={stamp(entry.updated_at)}
						/>
						{entry.deleted_at && (
							<ViewField
								label={
									translations[
										'order-return.field.deleted_at'
									]
								}
								value={
									<span className="text-danger">
										{stamp(entry.deleted_at)}
									</span>
								}
							/>
						)}
					</ViewSection>
				</TabsContent>

				<TabsContent id="lines">
					<ViewSection layout="rows">
						<p className="text-sm text-muted">
							{
								translations[
									'order-return.text.lines_requested_hint'
								]
							}
						</p>
						{lines.length === 0 ? (
							<p className="text-sm text-muted">
								{translations['order-return.text.no_lines']}
							</p>
						) : (
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
										<th className="py-2 pr-4 text-left font-medium">
											{
												translations[
													'order-return.field.variant'
												]
											}
										</th>
										<th className="py-2 text-right font-medium">
											{
												translations[
													'order-return.field.quantity'
												]
											}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-line">
									{lines.map((line) => (
										<tr key={line.id}>
											<td className="py-2 pr-4 align-top">
												<div className="font-medium">
													{displayOrderReturnLineLabel(
														line,
													)}
												</div>
												{line.sku && (
													<div className="text-xs text-muted">
														{line.sku}
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
						)}
					</ViewSection>
				</TabsContent>
			</Tabs>
		</div>
	);
}
