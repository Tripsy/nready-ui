'use client';

import { useMemo } from 'react';
import {
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { formatAmount } from '@/helpers/display.helper';
import { ownErrorMessages } from '@/helpers/form.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useWindowForm } from '@/providers/window-form.provider';

const TRANSLATION_KEYS = [
	'invoice.field.amount',
	'invoice.field.line',
	'invoice.field.net_left',
	'invoice.field.notes',
	'invoice.field.qty_left',
	'invoice.field.reverse_by',
	'invoice.text.everything_on_this_invoice_has_already',
	'invoice.text.leave_a_line_empty_or_at',
	'invoice.text.mode_quantity',
	'invoice.text.mode_net_value',
	'invoice.text.unit_price_net',
	'invoice.text.label_reverse_by',
	'invoice.text.label_reverse_quantity',
	'invoice.text.label_reverse_net',
	'invoice.text.placeholder_max',
] as const;

/**
 * How one line of the original is taken back. A line whose figure is left empty or at zero is
 * not taken back at all.
 *
 * - `quantity` - goods returned: the line's figures for that many units, and the units become
 *   billable again on the order.
 * - `value` - a **net** price correction on goods the client keeps; VAT is added by the API at
 *   the line's own rate, and nothing becomes billable again.
 */
export const ReverseLineModeEnum = {
	QUANTITY: 'quantity',
	VALUE: 'value',
} as const;

export type ReverseLineMode =
	(typeof ReverseLineModeEnum)[keyof typeof ReverseLineModeEnum];

/**
 * One line of the original as the form edits it. The `max_*` figures are what earlier reversals
 * left - the API enforces the same caps, these only keep the operator from typing past them.
 */
export type ReverseLineFormType = {
	invoice_line_id: number;
	label: string;
	mode: ReverseLineMode;
	quantity: number | null;
	amount: number | null;
	max_quantity: number;
	max_net: number;
	unit_price: number;
};

export type InvoiceReverseFormValuesType = {
	lines: ReverseLineFormType[];
	notes: string | null;
	/** Display only - the currency every figure is quoted in. */
	currency: string | null;
};

/**
 * Raises a reversal (storno) against an issued invoice, line by line.
 *
 * Each line is taken back by quantity or by net value; clearing its figure (or setting it to
 * zero) leaves the line out. Every line opens on quantity, prefilled with the units left - see
 * `getReverseFormState` for the one line that opens empty.
 */
export function FormReverseInvoice() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const modeOptions = useMemo(
		() => [
			{
				label: translations['invoice.text.mode_quantity'],
				value: ReverseLineModeEnum.QUANTITY,
			},
			{
				label: translations['invoice.text.mode_net_value'],
				value: ReverseLineModeEnum.VALUE,
			},
		],
		[translations],
	);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<InvoiceReverseFormValuesType>();

	const elementIds = useElementIds(['notes'] as const);

	const lines = formValues.lines ?? [];
	const currency = formValues.currency ?? '';

	const updateLine = (index: number, patch: Partial<ReverseLineFormType>) => {
		handleChange(
			'lines',
			lines.map((line, position) =>
				position === index ? { ...line, ...patch } : line,
			),
		);
	};

	const money = (value: number) => {
		const amount = formatAmount(value, currency);

		return `${amount.value} ${amount.currency}`;
	};

	return (
		<>
			{/*
			 * The whole list in one hidden field. Per-input names cannot express a list of
			 * objects, and the pipeline reads it back with `getFormDataAsJsonList`.
			 */}
			<input type="hidden" name="lines" value={JSON.stringify(lines)} />
			<input type="hidden" name="currency" value={currency} />

			{lines.length === 0 ? (
				<p className="text-sm text-muted">
					{
						translations[
							'invoice.text.everything_on_this_invoice_has_already'
						]
					}
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
								<th className="py-2 pr-4 text-left font-medium">
									{translations['invoice.field.line']}
								</th>
								<th className="py-2 pr-4 text-right font-medium">
									{translations['invoice.field.qty_left']}
								</th>
								<th className="py-2 pr-4 text-right font-medium">
									{translations['invoice.field.net_left']}
								</th>
								<th className="py-2 pr-4 text-left font-medium">
									{translations['invoice.field.reverse_by']}
								</th>
								<th className="py-2 text-left font-medium">
									{translations['invoice.field.amount']}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{lines.map((line, index) => (
								<tr key={line.invoice_line_id}>
									<td className="py-2 pr-4 align-middle">
										<div className="font-medium">
											{line.label}
										</div>
										<div className="text-xs text-muted">
											{replaceVars(
												translations[
													'invoice.text.unit_price_net'
												],
												{
													price: money(
														line.unit_price,
													),
												},
											)}
										</div>
									</td>
									<td className="py-2 pr-4 text-right align-middle">
										{line.max_quantity}
									</td>
									<td className="py-2 pr-4 text-right align-middle">
										{money(line.max_net)}
									</td>
									<td className="py-2 pr-4 align-middle">
										<FormComponentSelect<ReverseLineFormType>
											id={`reverse-mode-${line.invoice_line_id}`}
											ariaLabel={replaceVars(
												translations[
													'invoice.text.label_reverse_by'
												],
												{
													label: line.label,
												},
											)}
											fieldName="mode"
											fieldValue={line.mode}
											disabled={pending}
											className="w-36"
											options={modeOptions}
											onChange={(value) =>
												updateLine(index, {
													mode: value as ReverseLineMode,
													// Start from what is left, the
													// same figure the form opened on
													quantity:
														value ===
														ReverseLineModeEnum.QUANTITY
															? line.max_quantity
															: null,
													amount:
														value ===
														ReverseLineModeEnum.VALUE
															? line.max_net
															: null,
												})
											}
										/>
									</td>
									<td className="py-2 align-middle">
										{line.mode ===
										ReverseLineModeEnum.QUANTITY ? (
											<FormComponentInput<ReverseLineFormType>
												id={`reverse-quantity-${line.invoice_line_id}`}
												ariaLabel={replaceVars(
													translations[
														'invoice.text.label_reverse_quantity'
													],
													{
														label: line.label,
													},
												)}
												fieldName="quantity"
												fieldType="number"
												fieldValue={line.quantity ?? ''}
												disabled={pending}
												className="w-28"
												placeholderText={replaceVars(
													translations[
														'invoice.text.placeholder_max'
													],
													{
														max: line.max_quantity,
													},
												)}
												onChange={(e) =>
													updateLine(index, {
														quantity:
															e.target.value ===
															''
																? null
																: Number(
																		e.target
																			.value,
																	),
													})
												}
											/>
										) : (
											<FormComponentInput<ReverseLineFormType>
												id={`reverse-amount-${line.invoice_line_id}`}
												ariaLabel={replaceVars(
													translations[
														'invoice.text.label_reverse_net'
													],
													{
														label: line.label,
													},
												)}
												fieldName="amount"
												fieldType="number"
												fieldValue={line.amount ?? ''}
												disabled={pending}
												className="w-32"
												placeholderText={replaceVars(
													translations[
														'invoice.text.placeholder_max'
													],
													{
														max: line.max_net,
													},
												)}
												onChange={(e) =>
													updateLine(index, {
														amount:
															e.target.value ===
															''
																? null
																: Number(
																		e.target
																			.value,
																	),
													})
												}
											/>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{ownErrorMessages(errors.lines)?.map((message) => (
				<p key={message} className="text-sm text-danger">
					{message}
				</p>
			))}

			<p className="text-xs text-muted">
				{translations['invoice.text.leave_a_line_empty_or_at']}
			</p>

			<FormComponentTextarea<InvoiceReverseFormValuesType>
				labelText={translations['invoice.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				rows={2}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
