import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { formatAmount } from '@/helpers/display.helper';
import { requestFind } from '@/helpers/services.helper';
import { resolveWindowEntries } from '@/helpers/window.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	CashFlowDirectionEnum,
	type CashFlowModel,
	CashFlowStatusEnum,
} from '@/models/cash-flow.model';
import { type InvoiceModel, InvoiceTypeEnum } from '@/models/invoice.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';

export type InvoiceAllocatePaymentFormValuesType = {
	cash_flow_id: number | null;
	amount: number | null;
	notes: string | null;
	/** What the picker shows; the id beside it is what is submitted. */
	cash_flow: string | null;
};

/**
 * Settles part or all of an issued document against a cash movement.
 *
 * Only completed movements in the direction the document settles are offered - money that
 * actually moved, in for a charge and out for a credit note. The API refuses what cannot be
 * narrowed here: a movement in another currency, and an amount past what is left of it after its
 * other allocations.
 *
 * `amount` is **gross**, in the invoice currency - not the net figure the movement carries, which
 * is stored scaled and excludes VAT.
 */
export function FormAllocatePaymentInvoice() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<InvoiceAllocatePaymentFormValuesType>();

	const { getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const { entry } = windowConfig
		? resolveWindowEntries(windowConfig, 'form')
		: {};

	const invoice = entry as InvoiceModel | undefined;

	/*
	 * A charge is settled by money coming in and a credit note by money going back out. Offering
	 * the wrong half would hand the operator entries the API refuses on submit - and every `out`
	 * movement reads as a negative amount, which is not what settles a charge.
	 */
	const direction =
		invoice?.type === InvoiceTypeEnum.CREDIT_NOTE
			? CashFlowDirectionEnum.OUT
			: CashFlowDirectionEnum.IN;

	const elementIds = useElementIds(['cashFlow', 'amount', 'notes'] as const);

	const [searchCashFlow, setSearchCashFlow] = useState('');

	const { suggestions: cashFlowSuggestions, isFetching: isCashFlowFetching } =
		useRemoteAutocomplete<CashFlowModel>({
			query: searchCashFlow,
			queryKey: ['s-cash-flow', direction, invoice?.currency],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<CashFlowModel> | undefined =
					await requestFind('cash-flow', {
						filter: {
							term: q,
							status: CashFlowStatusEnum.COMPLETED,
							direction: direction,
							currency: invoice?.currency,
						},
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	/*
	 * The gross worth is what an allocation draws on, and it is formatted rather than printed
	 * raw - the column is a float and renders as `2890.5099999999998` otherwise.
	 */
	const displayCashFlowLabel = (cashFlow: CashFlowModel) => {
		const amount = formatAmount(
			Math.abs(cashFlow.gross_amount),
			cashFlow.currency,
		);

		return `#${cashFlow.id} ${amount.value} ${amount.currency}${
			cashFlow.external_reference
				? ` (${cashFlow.external_reference})`
				: ''
		}`;
	};

	return (
		<>
			<input
				type="hidden"
				name="cash_flow_id"
				value={formValues.cash_flow_id ?? ''}
			/>

			<FormComponentAutoComplete<
				InvoiceAllocatePaymentFormValuesType,
				CashFlowModel
			>
				labelText="Cash Flow"
				id={elementIds.cashFlow}
				fieldName="cash_flow"
				fieldValue={formValues.cash_flow ?? ''}
				isRequired={true}
				className="pl-8"
				disabled={pending}
				error={errors.cash_flow_id}
				onInputChange={(value) => {
					handleChange('cash_flow', value);
					handleChange('cash_flow_id', null);
					setSearchCashFlow(value);
				}}
				autoCompleteProps={{
					suggestions: cashFlowSuggestions,
					isLoading: isCashFlowFetching,
					onSelect: (m) => {
						handleChange('cash_flow', displayCashFlowLabel(m));
						handleChange('cash_flow_id', m.id);
					},
					getOptionLabel: (m) => displayCashFlowLabel(m),
					getOptionKey: (m) => m.id,
				}}
				icons={{
					left: <Icons.CashFlow className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentInput<InvoiceAllocatePaymentFormValuesType>
				labelText="Amount"
				id={elementIds.amount}
				fieldName="amount"
				fieldType="number"
				fieldValue={formValues.amount ?? null}
				isRequired={true}
				placeholderText="gross, in the invoice currency"
				disabled={pending}
				onChange={(e) =>
					handleChange(
						'amount',
						e.target.value === '' ? null : Number(e.target.value),
					)
				}
				error={errors.amount}
			/>

			<FormComponentTextarea<InvoiceAllocatePaymentFormValuesType>
				labelText="Notes"
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				rows={3}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
