'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
	FormTargetStockAdjustment,
	type StockAdjustmentTargetFormType,
} from '@/app/(dashboard)/dashboard/stock-adjustment/form-target-stock-adjustment.component';
import {
	FormComponentInput,
	FormComponentRadio,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { getResponseData } from '@/helpers/api.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	STOCK_ADJUSTMENT_REASONS,
	type StockAdjustmentDirection,
	StockAdjustmentDirectionEnum,
	type StockAdjustmentReason,
	StockAdjustmentReasonEnum,
} from '@/models/stock-adjustment.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { requestVariantStock } from '@/services/warehouse-movement.service';
import type { EntityId } from '@/types/entity-id.type';

const TRANSLATION_KEYS = [
	'stock-adjustment.field.warehouse',
	'stock-adjustment.field.variant',
	'stock-adjustment.field.direction',
	'stock-adjustment.field.qty',
	'stock-adjustment.field.reason',
	'stock-adjustment.field.notes',
	'stock-adjustment.text.form_hint',
	'stock-adjustment.text.books_result',
	'stock-adjustment.text.books_loading',
	'stock-adjustment.text.placeholder_notes',
	'stock-adjustment.text.placeholder_reason',
	...enumTranslationKeys(
		'stock-adjustment.enum.direction',
		StockAdjustmentDirectionEnum,
	),
	...enumTranslationKeys(
		'stock-adjustment.enum.reason',
		StockAdjustmentReasonEnum,
	),
] as const;

export type StockAdjustmentFormValuesType = StockAdjustmentTargetFormType & {
	direction: StockAdjustmentDirection;
	qty: number | null;
	reason: StockAdjustmentReason | null;
	notes: string | null;
};

/**
 * What the books hold at the picked warehouse, and where the adjustment would leave them.
 *
 * Shown, never sent: the backend moves the lots under their locks, and the figure here can change
 * between reading it and pressing the button. Read live for the same reason, once both pickers
 * have a row.
 */
function BooksFigure({
	warehouseId,
	variantId,
	change,
	translations,
}: {
	warehouseId: EntityId;
	variantId: EntityId;
	change: number | null;
	translations: Readonly<Record<(typeof TRANSLATION_KEYS)[number], string>>;
}) {
	const { data, isLoading } = useQuery({
		queryKey: ['warehouse-movement', 'stock', variantId],
		queryFn: async () =>
			getResponseData(await requestVariantStock(variantId)),
		staleTime: 0,
	});

	if (isLoading) {
		return (
			<p className="text-sm text-muted">
				{translations['stock-adjustment.text.books_loading']}
			</p>
		);
	}

	// A warehouse holding none of the variant is absent from the list - zero on the books
	const onHand =
		data?.warehouses.find((site) => site.warehouse_id === warehouseId)
			?.on_hand ?? 0;

	return (
		<p className="text-sm text-muted">
			{replaceVars(translations['stock-adjustment.text.books_result'], {
				on_hand: onHand,
				result:
					change === null
						? onHand
						: Math.round((onHand + change) * 100) / 100,
			})}
		</p>
	);
}

/**
 * Units in or out of one warehouse. The direction comes first because it decides which reasons
 * make sense - switching it drops a reason the other side does not offer, rather than leaving the
 * form holding a combination the backend refuses.
 */
export function FormManageStockAdjustment() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<StockAdjustmentFormValuesType>();

	const elementIds = useElementIds([
		'warehouse',
		'variant',
		'direction',
		'qty',
		'reason',
		'notes',
	] as const);

	const directions = useMemo(
		() =>
			Object.values(StockAdjustmentDirectionEnum).map((value) => ({
				value: value,
				label: translateEnumLabel(
					translations,
					'stock-adjustment.enum.direction',
					value,
				),
			})),
		[translations],
	);

	const reasons = useMemo(
		() =>
			STOCK_ADJUSTMENT_REASONS[formValues.direction].map((value) => ({
				value: value,
				label: translateEnumLabel(
					translations,
					'stock-adjustment.enum.reason',
					value,
				),
			})),
		[translations, formValues.direction],
	);

	const change =
		formValues.qty === null
			? null
			: formValues.direction === StockAdjustmentDirectionEnum.REMOVE
				? -formValues.qty
				: formValues.qty;

	return (
		<div className="form-section">
			<p className="text-sm text-muted">
				{translations['stock-adjustment.text.form_hint']}
			</p>

			<FormTargetStockAdjustment
				labels={{
					warehouse: translations['stock-adjustment.field.warehouse'],
					variant: translations['stock-adjustment.field.variant'],
				}}
				elementIds={elementIds}
			/>

			<FormComponentRadio<StockAdjustmentFormValuesType>
				id={elementIds.direction}
				labelText={translations['stock-adjustment.field.direction']}
				fieldName="direction"
				fieldValue={formValues.direction}
				isRequired={true}
				disabled={pending}
				options={directions}
				onChange={(value) => {
					const direction = value as StockAdjustmentDirection;

					handleChange('direction', direction);

					if (
						formValues.reason &&
						!STOCK_ADJUSTMENT_REASONS[direction].includes(
							formValues.reason,
						)
					) {
						handleChange('reason', null);
					}
				}}
				error={errors.direction}
			/>

			<div className="flex flex-wrap gap-4">
				<FormComponentInput<StockAdjustmentFormValuesType>
					labelText={translations['stock-adjustment.field.qty']}
					id={elementIds.qty}
					fieldName="qty"
					fieldValue={formValues.qty ?? ''}
					isRequired={true}
					disabled={pending}
					className="w-40"
					onChange={(e) =>
						handleChange(
							'qty',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.qty}
				/>

				<FormComponentSelect<StockAdjustmentFormValuesType>
					labelText={translations['stock-adjustment.field.reason']}
					id={elementIds.reason}
					fieldName="reason"
					fieldValue={formValues.reason ?? ''}
					isRequired={true}
					disabled={pending}
					className="w-56"
					placeholderText={
						translations['stock-adjustment.text.placeholder_reason']
					}
					options={reasons}
					onChange={(value) =>
						handleChange(
							'reason',
							(value || null) as StockAdjustmentReason | null,
						)
					}
					error={errors.reason}
				/>
			</div>

			{formValues.warehouse_id !== null &&
				formValues.variant_id !== null && (
					<BooksFigure
						warehouseId={formValues.warehouse_id}
						variantId={formValues.variant_id}
						change={change}
						translations={translations}
					/>
				)}

			<FormComponentTextarea<StockAdjustmentFormValuesType>
				labelText={translations['stock-adjustment.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				isRequired={false}
				rows={3}
				disabled={pending}
				placeholderText={
					translations['stock-adjustment.text.placeholder_notes']
				}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</div>
	);
}
