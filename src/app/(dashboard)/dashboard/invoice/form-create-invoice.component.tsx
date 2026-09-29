import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { INVOICEABLE_ORDER_STATUSES } from '@/models/invoice.model';
import { displayOrderReference, type OrderModel } from '@/models/order.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

export type InvoiceCreateFormValuesType = {
	order_id: number | null;
	due_at: string | null;
	notes: string | null;
	/** What the picker shows; the id beside it is what is submitted. */
	order: string | null;
};

/**
 * A document is raised from an order and never from nothing: the API generates its lines from
 * that order's lines and the shipping movements it carries, freezing the labels, prices and VAT
 * rates as they read on the day.
 *
 * There is no type to choose: `charge` is the only one a document can be raised as. A credit note
 * is raised against the charge it reverses, through the credit note action on that document.
 */
export function FormCreateInvoice() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<InvoiceCreateFormValuesType>();

	const elementIds = useElementIds(['order', 'dueAt', 'notes'] as const);

	const [searchOrder, setSearchOrder] = useState('');

	const { suggestions: orderSuggestions, isFetching: isOrderFetching } =
		useRemoteAutocomplete<OrderModel>({
			query: searchOrder,
			queryKey: ['s-order'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<OrderModel> | undefined =
					await requestFind('order', {
						filter: {
							term: q,
							// Both states a document may be raised from. A completed order
							// is the commoner case and was unreachable while this asked for
							// `confirmed` alone.
							status: INVOICEABLE_ORDER_STATUSES,
						},
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	return (
		<>
			<input
				type="hidden"
				name="order_id"
				value={formValues.order_id ?? ''}
			/>

			<FormComponentAutoComplete<InvoiceCreateFormValuesType, OrderModel>
				labelText="Order"
				id={elementIds.order}
				fieldName="order"
				fieldValue={formValues.order ?? ''}
				isRequired={true}
				className="pl-8"
				disabled={pending}
				error={errors.order_id}
				onInputChange={(value) => {
					handleChange('order', value);
					// The id goes with the text it stood for; leaving it behind would submit
					// the order the operator has just typed over
					handleChange('order_id', null);
					setSearchOrder(value);
				}}
				autoCompleteProps={{
					suggestions: orderSuggestions,
					isLoading: isOrderFetching,
					onSelect: (m) => {
						handleChange('order', displayOrderReference(m));
						handleChange('order_id', m.id);
					},
					getOptionLabel: (m) => displayOrderReference(m),
					getOptionKey: (m) => m.id,
				}}
				icons={{
					left: <Icons.Order className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentCalendar<InvoiceCreateFormValuesType>
				labelText="Due At"
				id={elementIds.dueAt}
				fieldName="due_at"
				fieldValue={formValues.due_at ?? ''}
				placeholderText="-select-"
				disabled={pending}
				onSelect={(value) =>
					handleChange('due_at', value === '' ? null : value)
				}
				error={errors.due_at}
			/>

			<FormComponentTextarea<InvoiceCreateFormValuesType>
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
