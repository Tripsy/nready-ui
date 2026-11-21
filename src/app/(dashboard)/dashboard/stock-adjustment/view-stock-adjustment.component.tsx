'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	adjustmentDirection,
	StockAdjustmentDirectionEnum,
	type StockAdjustmentModel,
	StockAdjustmentReasonEnum,
} from '@/models/stock-adjustment.model';
import {
	displayMovementVariant,
	displayMovementWarehouse,
	displaySignedQuantity,
	WarehouseMovementTypeEnum,
} from '@/models/warehouse-movement.model';

const TRANSLATION_KEYS = [
	'stock-adjustment.field.id',
	'stock-adjustment.field.direction',
	'stock-adjustment.field.reason',
	'stock-adjustment.field.warehouse',
	'stock-adjustment.field.variant',
	'stock-adjustment.field.qty',
	'stock-adjustment.field.notes',
	'stock-adjustment.field.created_at',
	'stock-adjustment.field.reversed_at',
	'stock-adjustment.field.movement_type',
	'stock-adjustment.field.lot',
	'stock-adjustment.field.unit_cost_base',
	'stock-adjustment.section.info',
	'stock-adjustment.section.movements',
	'stock-adjustment.text.no_movements',
	'stock-adjustment.text.lot_ref',
	...enumTranslationKeys(
		'stock-adjustment.enum.direction',
		StockAdjustmentDirectionEnum,
	),
	...enumTranslationKeys(
		'stock-adjustment.enum.reason',
		StockAdjustmentReasonEnum,
	),
	...enumTranslationKeys(
		'warehouse-movement.enum.movement_type',
		WarehouseMovementTypeEnum,
	),
] as const;

/**
 * One adjustment: what was decided, then the ledger rows it posted per lot - and, once reversed,
 * the rows that undid each, in the order they were written.
 */
export function ViewStockAdjustment({
	entry,
}: {
	entry: StockAdjustmentModel;
}) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const movements = entry.movements ?? [];

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['stock-adjustment.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2 text-muted">
					{translateEnumLabel(
						translations,
						'stock-adjustment.enum.direction',
						adjustmentDirection(entry),
					)}
				</span>
				<div className="ml-2 max-w-60">
					<DisplayStatus
						status={entry.status}
						dataSource="stock-adjustment"
					/>
				</div>
			</div>

			<ViewSection title={translations['stock-adjustment.section.info']}>
				<ViewField
					label={translations['stock-adjustment.field.variant']}
					value={displayMovementVariant(entry)}
				/>
				<ViewField
					label={translations['stock-adjustment.field.warehouse']}
					value={displayMovementWarehouse(entry)}
				/>
				<ViewField
					label={translations['stock-adjustment.field.qty']}
					value={
						<span className="font-semibold tabular-nums">
							{displaySignedQuantity(entry.qty)}
						</span>
					}
				/>
				<ViewField
					label={translations['stock-adjustment.field.reason']}
					value={translateEnumLabel(
						translations,
						'stock-adjustment.enum.reason',
						entry.reason,
					)}
				/>
				<ViewField
					label={translations['stock-adjustment.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				{entry.reversed_at && (
					<ViewField
						label={
							translations['stock-adjustment.field.reversed_at']
						}
						value={formatDate(entry.reversed_at, 'date-time')}
					/>
				)}
				<ViewField
					label={translations['stock-adjustment.field.notes']}
					value={entry.notes ?? '-'}
					full={true}
				/>
			</ViewSection>

			<ViewSection
				title={replaceVars(
					translations['stock-adjustment.section.movements'],
					{ length: movements.length },
				)}
				layout="rows"
			>
				{movements.length === 0 ? (
					<p className="text-sm text-muted">
						{translations['stock-adjustment.text.no_movements']}
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
									<th className="py-2 pr-4 text-left font-medium">
										{
											translations[
												'stock-adjustment.field.movement_type'
											]
										}
									</th>
									<th className="py-2 pr-4 text-left font-medium">
										{
											translations[
												'stock-adjustment.field.lot'
											]
										}
									</th>
									<th className="py-2 pr-4 text-right font-medium">
										{
											translations[
												'stock-adjustment.field.qty'
											]
										}
									</th>
									<th className="py-2 text-right font-medium">
										{
											translations[
												'stock-adjustment.field.unit_cost_base'
											]
										}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-line">
								{movements.map((movement) => (
									<tr
										key={movement.id}
										className={
											movement.reversal_of_id !== null
												? 'text-muted'
												: undefined
										}
									>
										<td className="py-2 pr-4">
											{translateEnumLabel(
												translations,
												'warehouse-movement.enum.movement_type',
												movement.movement_type,
											)}
										</td>
										<td className="py-2 pr-4">
											{movement.grn_item_id !== null
												? replaceVars(
														translations[
															'stock-adjustment.text.lot_ref'
														],
														{
															id: movement.grn_item_id,
														},
													)
												: '-'}
										</td>
										<td className="py-2 pr-4 text-right tabular-nums">
											{displaySignedQuantity(
												movement.qty,
											)}
										</td>
										<td className="py-2 text-right tabular-nums">
											{movement.unit_cost_base}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</ViewSection>
		</div>
	);
}
