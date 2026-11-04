'use client';

import {
	ViewField,
	ViewRow,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayShippingDestination,
	displayShippingDocument,
	displayShippingEnd,
	ShippingMethodEnum,
	type ShippingModel,
	ShippingScopeEnum,
} from '@/models/shipping.model';

const TRANSLATION_KEYS = [
	'shipping.field.contact_email',
	'shipping.field.contact_name',
	'shipping.field.contact_phone',
	'shipping.field.created_at',
	'shipping.field.deleted_at',
	'shipping.field.delivered_at',
	'shipping.field.discount_reduction',
	'shipping.field.document',
	'shipping.field.estimated_delivery_at',
	'shipping.field.from',
	'shipping.field.id',
	'shipping.field.item',
	'shipping.field.method',
	'shipping.field.name',
	'shipping.field.notes',
	'shipping.field.operational_cost',
	'shipping.field.price',
	'shipping.field.qty',
	'shipping.field.scope',
	'shipping.field.shipped_at',
	'shipping.field.to',
	'shipping.field.tracking_number',
	'shipping.field.tracking_url',
	'shipping.field.updated_at',
	'shipping.field.vat_rate',
	'shipping.section.contact',
	'shipping.section.cost',
	'shipping.section.dates',
	'shipping.section.info',
	'shipping.section.notes',
	'shipping.section.route',
	'shipping.section.timestamps',
	'shipping.text.details',
	'shipping.text.lines',
	'shipping.text.no_lines',
	'shipping.text.not_recorded',
	'shipping.text.variant_ref',
	'shipping.text.product_variant_ref',
	'shipping.text.doc_ref',
	'shipping.text.self_pickup_destination',
	...enumTranslationKeys('shipping.enum.scope', ShippingScopeEnum),
	...enumTranslationKeys('shipping.enum.method', ShippingMethodEnum),
] as const;

/** What `operational_cost` is kept in, whatever currency the client is billed in. */
const BASE_CURRENCY = Configuration.get('app.currency');

export function ViewShipping({ entry }: { entry: ShippingModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const lines = entry.lines ?? [];

	const pickup = displayShippingEnd(
		entry.pickup_data,
		entry.pickup_warehouse,
		entry.pickup_client_address_id,
		entry.pickup_client_address_label,
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['shipping.field.id']}
				</span>{' '}
				{entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus
						status={entry.status}
						dataSource="shipping"
					/>
				</div>
			</div>

			<Tabs defaultSelectedKey="details" className="w-full">
				<TabsList>
					<TabsTrigger id="details">
						{translations['shipping.text.details']}
					</TabsTrigger>
					<TabsTrigger id="lines">
						{translations['shipping.text.lines']}
						<span className="ml-1.5 text-xs text-muted">
							{lines.length}
						</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent id="details" className="space-y-6">
					<ViewSection title={translations['shipping.section.info']}>
						<ViewField
							label={translations['shipping.field.scope']}
							value={translateEnumLabel(
								translations,
								'shipping.enum.scope',
								entry.scope,
							)}
						/>
						<ViewField
							label={translations['shipping.field.document']}
							value={displayShippingDocument(
								entry,
								translations['shipping.text.doc_ref'],
							)}
						/>
						<ViewField
							label={translations['shipping.field.method']}
							value={translateEnumLabel(
								translations,
								'shipping.enum.method',
								entry.method,
							)}
						/>
						<ViewField
							label={translations['shipping.field.name']}
							value={entry.carrier?.name ?? '-'}
						/>
						<ViewField
							label={
								translations['shipping.field.tracking_number']
							}
							value={entry.tracking_number ?? '-'}
						/>
						<ViewField
							label={translations['shipping.field.tracking_url']}
							value={entry.tracking_url ?? '-'}
						/>
					</ViewSection>

					{/*
					 * Both ends are frozen when the movement is marked shipped, so before that this reports
					 * the live reference instead - the two can legitimately differ while it is still being
					 * prepared, and the live one is what a correction would reach.
					 */}
					<ViewSection
						title={translations['shipping.section.route']}
						layout="rows"
					>
						{/* Half the width each: a full address needs the room a third would not give it */}
						<ViewRow className="lg:grid-cols-2">
							<ViewField
								label={translations['shipping.field.from']}
								value={pickup}
							/>
							<ViewField
								label={translations['shipping.field.to']}
								value={displayShippingDestination(
									entry,
									translations[
										'shipping.text.self_pickup_destination'
									],
								)}
							/>
						</ViewRow>
					</ViewSection>

					<ViewSection
						title={translations['shipping.section.contact']}
					>
						<ViewField
							label={translations['shipping.field.contact_name']}
							value={entry.contact_name ?? '-'}
						/>
						<ViewField
							label={translations['shipping.field.contact_phone']}
							value={entry.contact_phone ?? '-'}
						/>
						<ViewField
							label={translations['shipping.field.contact_email']}
							value={entry.contact_email ?? '-'}
						/>
					</ViewSection>

					<ViewSection title={translations['shipping.section.cost']}>
						<ViewField
							label={translations['shipping.field.price']}
							value={`${Number(entry.price).toFixed(2)} ${entry.currency}`}
						/>
						{Number(entry.discount_reduction ?? 0) > 0 && (
							<ViewField
								label={
									translations[
										'shipping.field.discount_reduction'
									]
								}
								value={`-${Number(entry.discount_reduction).toFixed(2)} ${entry.currency}${
									entry.discount?.[0]
										? ` (${entry.discount[0].label})`
										: ''
								}`}
							/>
						)}
						<ViewField
							label={translations['shipping.field.vat_rate']}
							value={`${Number(entry.vat_rate).toFixed(2)}%`}
						/>
						{/* Base currency, not the client's - see `ShippingModel.operational_cost` */}
						<ViewField
							label={
								translations['shipping.field.operational_cost']
							}
							value={
								typeof entry.operational_cost === 'number'
									? `${entry.operational_cost.toFixed(2)} ${BASE_CURRENCY}`
									: translations['shipping.text.not_recorded']
							}
						/>
					</ViewSection>

					<ViewSection title={translations['shipping.section.dates']}>
						<ViewField
							label={
								translations[
									'shipping.field.estimated_delivery_at'
								]
							}
							value={
								entry.estimated_delivery_at
									? formatDate(
											entry.estimated_delivery_at,
											'default',
										)
									: '-'
							}
						/>
						<ViewField
							label={translations['shipping.field.shipped_at']}
							value={
								entry.shipped_at
									? formatDate(entry.shipped_at, 'date-time')
									: '-'
							}
						/>
						<ViewField
							label={translations['shipping.field.delivered_at']}
							value={
								entry.delivered_at
									? formatDate(
											entry.delivered_at,
											'date-time',
										)
									: '-'
							}
						/>
					</ViewSection>

					{entry.notes && (
						<ViewSection
							title={translations['shipping.section.notes']}
						>
							<ViewField
								label={translations['shipping.field.notes']}
								value={entry.notes}
							/>
						</ViewSection>
					)}

					<ViewSection
						title={translations['shipping.section.timestamps']}
					>
						<ViewField
							label={translations['shipping.field.created_at']}
							value={formatDate(entry.created_at, 'date-time')}
						/>
						<ViewField
							label={translations['shipping.field.updated_at']}
							value={formatDate(entry.updated_at, 'date-time')}
						/>
						{entry.deleted_at && (
							<ViewField
								label={
									translations['shipping.field.deleted_at']
								}
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
								{translations['shipping.text.no_lines']}
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
											<th className="py-2 pr-4 text-left font-medium">
												{
													translations[
														'shipping.field.item'
													]
												}
											</th>
											<th className="py-2 text-right font-medium">
												{
													translations[
														'shipping.field.qty'
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
														{line.label ??
															line.sku ??
															replaceVars(
																translations[
																	'shipping.text.variant_ref'
																],
																{
																	id: line.variant_id,
																},
															)}
													</div>
													<div className="text-xs text-muted">
														{line.sku &&
															`${line.sku} · `}
														{replaceVars(
															translations[
																'shipping.text.product_variant_ref'
															],
															{
																product:
																	line.product_id,
																variant:
																	line.variant_id,
															},
														)}
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
				</TabsContent>
			</Tabs>
		</div>
	);
}
