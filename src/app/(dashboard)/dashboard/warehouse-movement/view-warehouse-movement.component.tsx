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
	displayMovementVariant,
	displayMovementWarehouse,
	displaySignedQuantity,
	type WarehouseMovementModel,
	WarehouseMovementSourceEnum,
	WarehouseMovementTypeEnum,
} from '@/models/warehouse-movement.model';

const TRANSLATION_KEYS = [
	'warehouse-movement.field.id',
	'warehouse-movement.field.movement_type',
	'warehouse-movement.field.occurred_at',
	'warehouse-movement.field.created_at',
	'warehouse-movement.field.variant',
	'warehouse-movement.field.warehouse',
	'warehouse-movement.field.qty',
	'warehouse-movement.field.unit_cost_base',
	'warehouse-movement.field.source',
	'warehouse-movement.field.lot',
	'warehouse-movement.field.reversal_of',
	'warehouse-movement.field.notes',
	'warehouse-movement.section.info',
	'warehouse-movement.section.source',
	'warehouse-movement.text.lot_ref',
	'warehouse-movement.text.movement_ref',
	'warehouse-movement.text.source_ref',
	...enumTranslationKeys(
		'warehouse-movement.enum.movement_type',
		WarehouseMovementTypeEnum,
	),
	...enumTranslationKeys(
		'warehouse-movement.enum.source_type',
		WarehouseMovementSourceEnum,
	),
] as const;

/** One ledger row: what moved, where, at what cost, and the document it answers to. */
export function ViewWarehouseMovement({
	entry,
}: {
	entry: WarehouseMovementModel;
}) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['warehouse-movement.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2 text-muted">
					{translateEnumLabel(
						translations,
						'warehouse-movement.enum.movement_type',
						entry.movement_type,
					)}
				</span>
			</div>

			<ViewSection
				title={translations['warehouse-movement.section.info']}
			>
				<ViewField
					label={translations['warehouse-movement.field.variant']}
					value={displayMovementVariant(entry)}
				/>
				<ViewField
					label={translations['warehouse-movement.field.warehouse']}
					value={displayMovementWarehouse(entry)}
				/>
				<ViewField
					label={translations['warehouse-movement.field.qty']}
					value={displaySignedQuantity(entry.qty)}
				/>
				<ViewField
					label={
						translations['warehouse-movement.field.unit_cost_base']
					}
					value={entry.unit_cost_base}
				/>
				<ViewField
					label={translations['warehouse-movement.field.occurred_at']}
					value={formatDate(entry.occurred_at, 'date-time')}
				/>
				<ViewField
					label={translations['warehouse-movement.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
			</ViewSection>

			<ViewSection
				title={translations['warehouse-movement.section.source']}
			>
				<ViewField
					label={translations['warehouse-movement.field.source']}
					value={replaceVars(
						translations['warehouse-movement.text.source_ref'],
						{
							type: translateEnumLabel(
								translations,
								'warehouse-movement.enum.source_type',
								entry.source_type,
							),
							id: entry.source_id ?? '-',
						},
					)}
				/>
				<ViewField
					label={translations['warehouse-movement.field.lot']}
					value={
						entry.grn_item_id === null
							? '-'
							: replaceVars(
									translations[
										'warehouse-movement.text.lot_ref'
									],
									{ id: entry.grn_item_id },
								)
					}
				/>
				<ViewField
					label={translations['warehouse-movement.field.reversal_of']}
					value={
						entry.reversal_of_id === null
							? '-'
							: replaceVars(
									translations[
										'warehouse-movement.text.movement_ref'
									],
									{ id: entry.reversal_of_id },
								)
					}
				/>
				<ViewField
					label={translations['warehouse-movement.field.notes']}
					value={entry.notes ?? '-'}
					full
				/>
			</ViewSection>
		</div>
	);
}
