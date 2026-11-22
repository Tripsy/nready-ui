'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { formatDate, toCalendarValue } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { displayGrnReference, type GrnModel } from '@/models/grn.model';

const TRANSLATION_KEYS = [
	'grn.field.id',
	'grn.field.reference',
	'grn.field.supplier_document_number',
	'grn.field.warehouse',
	'grn.field.vendor',
	'grn.field.received_at',
	'grn.field.confirmed_at',
	'grn.field.exchange_rate',
	'grn.field.notes',
	'grn.field.variant',
	'grn.field.qty',
	'grn.field.qty_remaining',
	'grn.field.unit_cost',
	'grn.field.unit_cost_base',
	'grn.field.vat_rate',
	'grn.field.lot_code',
	'grn.field.expires_at',
	'grn.field.created_at',
	'grn.field.updated_at',
	'grn.field.deleted_at',
	'grn.section.info',
	'grn.section.notes',
	'grn.section.timestamps',
	'grn.text.details',
	'grn.text.items',
	'grn.text.no_items',
	'grn.text.not_confirmed',
	'grn.text.variant_ref',
] as const;

/** What `unit_cost_base` is kept in, whatever currency the supplier invoiced in. */
const BASE_CURRENCY = Configuration.get('app.currency');

export function ViewGrn({ entry }: { entry: GrnModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const items = entry.items ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['grn.field.reference']}
				</span>{' '}
				{displayGrnReference(entry)}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="grn" />
				</div>
			</div>

			<Tabs defaultSelectedKey="details" className="w-full">
				<TabsList>
					<TabsTrigger id="details">
						{translations['grn.text.details']}
					</TabsTrigger>
					<TabsTrigger id="items">
						{translations['grn.text.items']}
						<span className="ml-1.5 text-xs text-muted">
							{items.length}
						</span>
					</TabsTrigger>
				</TabsList>

				<TabsContent id="details" className="space-y-6">
					<ViewSection title={translations['grn.section.info']}>
						<ViewField
							label={translations['grn.field.id']}
							value={entry.id}
						/>
						<ViewField
							label={
								translations[
									'grn.field.supplier_document_number'
								]
							}
							value={entry.supplier_document_number}
						/>
						<ViewField
							label={translations['grn.field.warehouse']}
							value={
								entry.warehouse
									? `${entry.warehouse.code} - ${entry.warehouse.name}`
									: `#${entry.warehouse_id}`
							}
						/>
						<ViewField
							label={translations['grn.field.vendor']}
							value={entry.vendor?.name ?? `#${entry.vendor_id}`}
						/>
						{entry.currency !== BASE_CURRENCY && (
							<ViewField
								label={translations['grn.field.exchange_rate']}
								value={Number(entry.exchange_rate)}
							/>
						)}
					</ViewSection>

					{entry.notes && (
						<ViewSection title={translations['grn.section.notes']}>
							<p className="whitespace-pre-line text-sm">
								{entry.notes}
							</p>
						</ViewSection>
					)}

					<ViewSection title={translations['grn.section.timestamps']}>
						<ViewField
							label={translations['grn.field.received_at']}
							// A calendar day sent as midnight UTC - see the list column
							value={toCalendarValue(entry.received_at)}
						/>
						<ViewField
							label={translations['grn.field.confirmed_at']}
							value={
								entry.confirmed_at
									? formatDate(
											entry.confirmed_at,
											'date-time',
										)
									: translations['grn.text.not_confirmed']
							}
						/>
						<ViewField
							label={translations['grn.field.created_at']}
							value={formatDate(entry.created_at, 'date-time')}
						/>
						<ViewField
							label={translations['grn.field.updated_at']}
							value={formatDate(entry.updated_at, 'date-time')}
						/>
						{entry.deleted_at && (
							<ViewField
								label={translations['grn.field.deleted_at']}
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

				<TabsContent id="items">
					<ViewSection layout="rows">
						{items.length === 0 ? (
							<p className="text-sm text-muted">
								{translations['grn.text.no_items']}
							</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
											<th className="py-2 pr-4 text-left font-medium">
												{
													translations[
														'grn.field.variant'
													]
												}
											</th>
											<th className="py-2 pr-4 text-right font-medium">
												{translations['grn.field.qty']}
											</th>
											<th className="py-2 pr-4 text-right font-medium">
												{
													translations[
														'grn.field.qty_remaining'
													]
												}
											</th>
											<th className="py-2 pr-4 text-right font-medium">
												{
													translations[
														'grn.field.unit_cost'
													]
												}
											</th>
											<th className="py-2 pr-4 text-right font-medium">
												{
													translations[
														'grn.field.unit_cost_base'
													]
												}
											</th>
											<th className="py-2 text-right font-medium">
												{
													translations[
														'grn.field.vat_rate'
													]
												}
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-line">
										{items.map((item) => (
											<tr key={item.id}>
												<td className="py-2 pr-4 align-top">
													<div className="font-medium">
														{item.label ??
															item.sku ??
															replaceVars(
																translations[
																	'grn.text.variant_ref'
																],
																{
																	id: item.variant_id,
																},
															)}
													</div>
													<div className="text-xs text-muted">
														{[
															item.sku,
															item.lot_code &&
																`${translations['grn.field.lot_code']}: ${item.lot_code}`,
															item.expires_at &&
																`${translations['grn.field.expires_at']}: ${formatDate(item.expires_at, 'default')}`,
														]
															.filter(Boolean)
															.join(' · ')}
													</div>
													{item.notes && (
														<div className="mt-1 text-xs italic text-muted">
															“{item.notes}”
														</div>
													)}
												</td>
												<td className="py-2 pr-4 text-right align-top">
													{Number(item.qty)}
												</td>
												<td className="py-2 pr-4 text-right align-top">
													{Number(item.qty_remaining)}
												</td>
												<td className="py-2 pr-4 text-right align-top">
													{Number(
														item.unit_cost,
													).toFixed(2)}{' '}
													{entry.currency}
												</td>
												<td className="py-2 pr-4 text-right align-top">
													{Number(
														item.unit_cost_base,
													).toFixed(4)}{' '}
													{BASE_CURRENCY}
												</td>
												<td className="py-2 text-right align-top">
													{Number(item.vat_rate)}%
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
