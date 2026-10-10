import { useState } from 'react';
import { FormComponentAutoComplete } from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	type ClientModel,
	ClientStatusEnum,
	displayClientLabel,
} from '@/models/client.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

export type InvoiceCreateFormValuesType = {
	client_id: number | null;
	/** What the picker shows; the id beside it is what is submitted. */
	client: string | null;
};

/**
 * A custom invoice: a document built by hand for a client, with no order behind it. It is the one
 * document raised here - an order's goods and deliveries, and a subscription's periods, are
 * invoiced as they happen, and a reversal is raised against the document it takes back.
 *
 * Only the client is asked for. The draft comes back empty and opens in the update window, where
 * its lines, buyer, seller, due date and notes are written exactly as on any other draft - one
 * form for both, rather than a second one to keep in step with it.
 */
export function FormCreateInvoice() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<InvoiceCreateFormValuesType>();

	const elementIds = useElementIds(['client'] as const);

	const [searchClient, setSearchClient] = useState('');

	const { suggestions: clientSuggestions, isFetching: isClientFetching } =
		useRemoteAutocomplete<ClientModel>({
			query: searchClient,
			queryKey: ['s-client'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<ClientModel> | undefined =
					await requestFind('client', {
						filter: {
							term: q,
							status: ClientStatusEnum.ACTIVE,
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
				name="client_id"
				value={formValues.client_id ?? ''}
			/>

			<FormComponentAutoComplete<InvoiceCreateFormValuesType, ClientModel>
				labelText="Client"
				id={elementIds.client}
				fieldName="client"
				fieldValue={formValues.client ?? ''}
				isRequired={true}
				className="pl-8"
				disabled={pending}
				error={errors.client_id}
				onInputChange={(value) => {
					handleChange('client', value);
					// The id goes with the text it stood for; leaving it behind would submit
					// the client the operator has just typed over
					handleChange('client_id', null);
					setSearchClient(value);
				}}
				autoCompleteProps={{
					suggestions: clientSuggestions,
					isLoading: isClientFetching,
					onSelect: (m) => {
						handleChange('client', displayClientLabel(m));
						handleChange('client_id', m.id);
					},
					getOptionLabel: (m) => displayClientLabel(m),
					getOptionKey: (m) => m.id,
				}}
				icons={{
					left: <Icons.Client className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>
		</>
	);
}
