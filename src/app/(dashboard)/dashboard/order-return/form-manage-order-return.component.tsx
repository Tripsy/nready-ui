'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getResponseData } from '@/helpers/api.helper';
import { ownErrorMessages, toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayOrderReference,
	type OrderModel,
	OrderStatusEnum,
} from '@/models/order.model';
import {
	type OrderReturnableLineModel,
	OrderReturnReasonEnum,
	type OrderReturnStatus,
	OrderReturnStatusEnum,
} from '@/models/order-return.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { requestOrderReturnable } from '@/services/order-return.service';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { EntityId } from '@/types/entity-id.type';

const TRANSLATION_KEYS = [
	'order-return.field.order',
	'order-return.field.reason',
	'order-return.field.customer_notes',
	'order-return.field.response',
	'order-return.field.notes',
	'order-return.field.refund_shipping',
	'order-return.field.quantity',
	'order-return.section.lines',
	'order-return.text.pick_order_first',
	'order-return.text.loading_returnable',
	'order-return.text.nothing_returnable',
	'order-return.text.returnable_quantity',
	'order-return.text.lines_hint',
	'order-return.text.decided_locked',
	'order-return.text.placeholder_customer_notes',
	'order-return.text.placeholder_response',
	'order-return.text.placeholder_notes',
	'order-return.text.variant_ref',
	...enumTranslationKeys('order-return.enum.reason', OrderReturnReasonEnum),
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

/** One line as the form holds it; `label` names it on screen and is never sent. */
export type OrderReturnLineFormType = {
	variant_id: EntityId;
	quantity: number | null;
	label: string | null;
};

export type OrderReturnFormValuesType = {
	order_id: EntityId | null;
	reason: string | null;
	customer_notes: string | null;
	response: string | null;
	notes: string | null;
	lines: OrderReturnLineFormType[];
	refund_shipping: boolean;
	// display-only fields, not part of validation
	/**
	 * Whether the refund is still ahead - a live return with nothing drafted. `refund_shipping` is
	 * read by the draft, so the backend takes it only while this holds. Submitted as
	 * `refund_open` and never sent on.
	 */
	refund_open: boolean;
	/** The order autocomplete's visible text. Submitted as `order_label` and never sent on. */
	order: string | null;
	/**
	 * The stored status, null on a create. Once decided only the text fields change - the
	 * backend answers 409 to the rest - so the form shows the others read-only.
	 */
	status: OrderReturnStatus | null;
};

/** Only an accepted order can have arrived goods to send back. */
const ORDER_FILTER = {
	status: [OrderStatusEnum.CONFIRMED, OrderStatusEnum.COMPLETED],
};

/**
 * What can come back, by variant - read from the backend's own count of what was delivered and
 * is not already claimed by another return. The request's own lines are added back on an edit,
 * since the count already takes them off. A quantity above what is shown answers 409 regardless.
 */
function OrderReturnLinesEditor({
	translations,
	orderId,
	lines,
	disabled,
	error,
	onChange,
}: {
	translations: TranslationsType;
	readonly orderId: EntityId | null;
	readonly lines: OrderReturnLineFormType[];
	readonly disabled: boolean;
	readonly error: string[] | undefined;
	readonly onChange: (lines: OrderReturnLineFormType[]) => void;
}) {
	// The lines this request held when the form opened, which the count no longer offers
	const [ownLines] = useState(lines);

	const { data: returnable, isLoading } = useQuery({
		queryKey: ['order-return', 'returnable', orderId],
		queryFn: async (): Promise<OrderReturnableLineModel[]> => {
			if (!orderId) {
				return [];
			}

			const response = await requestOrderReturnable(orderId);

			return getResponseData(response)?.lines ?? [];
		},
		enabled: !!orderId,
	});

	const rows = useMemo(() => {
		const byVariant = new Map<
			EntityId,
			{ variant_id: EntityId; label: string; available: number }
		>();

		for (const line of returnable ?? []) {
			byVariant.set(line.variant_id, {
				variant_id: line.variant_id,
				label:
					line.label ??
					line.sku ??
					replaceVars(translations['order-return.text.variant_ref'], {
						id: line.variant_id,
					}),
				available: Number(line.returnable),
			});
		}

		for (const own of ownLines) {
			const row = byVariant.get(own.variant_id);

			byVariant.set(own.variant_id, {
				variant_id: own.variant_id,
				label:
					row?.label ??
					own.label ??
					replaceVars(translations['order-return.text.variant_ref'], {
						id: own.variant_id,
					}),
				available: (row?.available ?? 0) + Number(own.quantity ?? 0),
			});
		}

		return [...byVariant.values()];
	}, [returnable, ownLines, translations]);

	if (!orderId) {
		return (
			<p className="text-sm text-muted">
				{translations['order-return.text.pick_order_first']}
			</p>
		);
	}

	if (isLoading) {
		return (
			<p className="text-sm text-muted">
				{translations['order-return.text.loading_returnable']}
			</p>
		);
	}

	if (rows.length === 0) {
		return (
			<p className="text-sm text-muted">
				{translations['order-return.text.nothing_returnable']}
			</p>
		);
	}

	const quantityFor = (variantId: EntityId): number | null =>
		lines.find((line) => line.variant_id === variantId)?.quantity ?? null;

	const setQuantity = (variantId: EntityId, label: string, value: string) => {
		const quantity = value === '' ? null : Number(value);
		const without = lines.filter((line) => line.variant_id !== variantId);

		onChange(
			quantity === null || quantity <= 0
				? without
				: [
						...without,
						{
							variant_id: variantId,
							quantity: quantity,
							label: label,
						},
					],
		);
	};

	return (
		<div className="flex flex-col gap-3">
			{rows.map((row) => (
				<div
					key={row.variant_id}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
				>
					<div className="min-w-0 flex-1">
						<div className="font-medium">{row.label}</div>
						<div className="text-xs text-muted">
							{replaceVars(
								translations[
									'order-return.text.returnable_quantity'
								],
								{ quantity: row.available },
							)}
						</div>
					</div>

					<FormComponentInput<OrderReturnLineFormType>
						labelText={translations['order-return.field.quantity']}
						id={`order-return-line-${row.variant_id}`}
						fieldName="quantity"
						fieldValue={quantityFor(row.variant_id) ?? ''}
						isRequired={false}
						disabled={disabled}
						className="w-32"
						placeholderText="0"
						onChange={(e) =>
							setQuantity(
								row.variant_id,
								row.label,
								e.target.value,
							)
						}
					/>
				</div>
			))}

			{error?.map((message) => (
				<p key={message} className="text-sm text-danger">
					{message}
				</p>
			))}
		</div>
	);
}

/**
 * Raising a return for a client, or correcting one. The order is picked once - a return belongs to
 * the order it was raised against - and the lines are offered from what that order still has to
 * send back. Once decided, the request itself is history: only the buyer-facing response and the
 * internal notes stay editable.
 */
export function FormManageOrderReturn() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<OrderReturnFormValuesType>();

	const elementIds = useElementIds([
		'order',
		'reason',
		'customer_notes',
		'response',
		'notes',
		'refund_shipping',
	] as const);

	const isExisting = formValues.status !== null;
	const isDecided =
		isExisting && formValues.status !== OrderReturnStatusEnum.REQUESTED;

	const reasons = useMemo(
		() =>
			toOptionsFromEnum(OrderReturnReasonEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'order-return.enum.reason',
						value,
					),
			}),
		[translations],
	);

	const [searchOrder, setSearchOrder] = useState('');

	const { suggestions: orderSuggestions, isFetching: isOrderFetching } =
		useRemoteAutocomplete<OrderModel>({
			query: searchOrder,
			queryKey: ['s-order-return-order'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<OrderModel>
					| undefined = await requestFind('order', {
					filter: { ...ORDER_FILTER, term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			// The backend refuses a shorter term (`filter.termMinLength`) with a 422
			minLength: 3,
		});

	const lines = formValues.lines ?? [];

	return (
		<div className="form-section">
			<input
				type="hidden"
				name="status"
				value={formValues.status ?? ''}
			/>
			<input
				type="hidden"
				name="order_id"
				value={formValues.order_id ?? ''}
			/>
			<input
				type="hidden"
				name="order_label"
				value={formValues.order ?? ''}
			/>
			{/*
			 * The whole list in one hidden field; per-input names cannot express a list of objects,
			 * and the pipeline reads it back with `getFormDataAsJsonList`.
			 */}
			<input type="hidden" name="lines" value={JSON.stringify(lines)} />
			<input
				type="hidden"
				name="refund_open"
				value={formValues.refund_open ? '1' : ''}
			/>

			{isDecided && (
				<p className="text-sm text-muted">
					{translations['order-return.text.decided_locked']}
				</p>
			)}

			<FormComponentAutoComplete<OrderReturnFormValuesType, OrderModel>
				labelText={translations['order-return.field.order']}
				id={elementIds.order}
				fieldName="order"
				fieldValue={formValues.order ?? ''}
				className="pl-8"
				isRequired={true}
				// A return stays with the order it was raised against
				disabled={pending || isExisting}
				error={errors.order_id}
				onInputChange={(value) => {
					handleChange('order', value);
					handleChange('order_id', null);
					handleChange('lines', []);
					setSearchOrder(value);
				}}
				autoCompleteProps={{
					suggestions: orderSuggestions,
					isLoading: isOrderFetching,
					onSelect: (order) => {
						handleChange('order', displayOrderReference(order));
						handleChange('order_id', order.id);
						handleChange('lines', []);
					},
					getOptionLabel: (order) => displayOrderReference(order),
					getOptionKey: (order) => order.id,
				}}
				icons={{
					left: <Icons.Order className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentSelect<OrderReturnFormValuesType>
				labelText={translations['order-return.field.reason']}
				id={elementIds.reason}
				fieldName="reason"
				fieldValue={formValues.reason ?? ''}
				isRequired={true}
				disabled={pending || isDecided}
				className="w-64"
				options={reasons}
				onChange={(value) => handleChange('reason', value)}
				error={errors.reason}
			/>

			<FormComponentTextarea<OrderReturnFormValuesType>
				labelText={translations['order-return.field.customer_notes']}
				id={elementIds.customer_notes}
				fieldName="customer_notes"
				fieldValue={formValues.customer_notes ?? ''}
				isRequired={false}
				disabled={pending}
				rows={3}
				placeholderText={
					translations['order-return.text.placeholder_customer_notes']
				}
				onChange={(e) => handleChange('customer_notes', e.target.value)}
				error={errors.customer_notes}
			/>

			{isExisting && (
				<FormComponentTextarea<OrderReturnFormValuesType>
					labelText={translations['order-return.field.response']}
					id={elementIds.response}
					fieldName="response"
					fieldValue={formValues.response ?? ''}
					isRequired={false}
					disabled={pending}
					rows={3}
					placeholderText={
						translations['order-return.text.placeholder_response']
					}
					onChange={(e) => handleChange('response', e.target.value)}
					error={errors.response}
				/>
			)}

			<FormComponentTextarea<OrderReturnFormValuesType>
				labelText={translations['order-return.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				isRequired={false}
				disabled={pending}
				rows={3}
				placeholderText={
					translations['order-return.text.placeholder_notes']
				}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>

			{isExisting && formValues.refund_open && (
				<FormComponentCheckbox<OrderReturnFormValuesType>
					id={elementIds.refund_shipping}
					fieldName="refund_shipping"
					checked={formValues.refund_shipping}
					disabled={pending}
					error={errors.refund_shipping}
					onCheckedChange={(value) =>
						handleChange('refund_shipping', value)
					}
				>
					{translations['order-return.field.refund_shipping']}
				</FormComponentCheckbox>
			)}

			{!isDecided && (
				<>
					<h3 className="pt-2 font-semibold">
						{translations['order-return.section.lines']}
					</h3>
					<p className="text-sm text-muted">
						{translations['order-return.text.lines_hint']}
					</p>
					<OrderReturnLinesEditor
						// Re-mounted per order, so the remembered own lines belong to it
						key={formValues.order_id ?? 'none'}
						translations={translations}
						orderId={formValues.order_id}
						lines={lines}
						disabled={pending}
						error={ownErrorMessages(errors.lines)}
						onChange={(value) => handleChange('lines', value)}
					/>
				</>
			)}
		</div>
	);
}
