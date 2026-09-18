import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentRadio,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { hasPermission } from '@/models/account.model';
import { type AddressModel, displayAddressLabel } from '@/models/address.model';
import {
	type ClientAddressType,
	ClientAddressTypeEnum,
} from '@/models/client-address.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export type ClientAddressFormValuesType = {
	client_id: number | null;
	address_id: number | null;
	type: ClientAddressType;
	/** Flat, floor or apartment number within the address. */
	details: string | null;
	/** Instructions about reaching the address. */
	notes: string | null;

	// display-only fields, not part of validation
	/** The address autocomplete's visible text. Submitted so a failed validation redraws it. */
	address: string | null;
};

const ADDRESS_SUGGESTIONS_KEY = 's-client-address-address';

const clientAddressTypes = Object.values(ClientAddressTypeEnum).map((v) => ({
	label: formatEnumLabel(v),
	value: v,
}));

export function FormManageClientAddress() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ClientAddressFormValuesType>();

	const { auth } = useAuth();
	const { open, focus, getCurrentWindow } = useModalStore();
	const queryClient = useQueryClient();

	// Gated on the permission `AddressPolicy` checks on create, not on this form's own - offering
	// a create the account cannot perform only defers the refusal to the submit
	const canCreateAddress = hasPermission(auth, 'address', 'create');

	const elementIds = useElementIds([
		'type',
		'address',
		'details',
		'notes',
	] as const);

	const language = getLanguageClient();

	const [searchAddress, setSearchAddress] = useState('');

	const { suggestions: addressSuggestions, isFetching: isAddressFetching } =
		useRemoteAutocomplete<AddressModel>({
			query: searchAddress,
			queryKey: [ADDRESS_SUGGESTIONS_KEY],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<AddressModel>
					| undefined = await requestFind('address', {
					filter: { term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	/**
	 * Creates the address the search could not find, in the address's own window - it is what
	 * collects the city and postal code a typed string has nowhere to put.
	 *
	 * `open` minimizes this form, so the parent is captured beforehand and focused again on
	 * success; otherwise the editor lands on an empty desktop with a half-filled form in the dock.
	 * The search cache is dropped as well: it still holds the empty result that prompted the create.
	 */
	const createAddress = (typedValue: string) => {
		const parentWindow = getCurrentWindow();

		open({
			minimized: false,
			section: DataSourceSectionEnum.DASHBOARD,
			dataSource: 'address',
			action: 'create',
			data: { prefillEntry: { details: typedValue } },
			events: {
				success: async (entry?: AddressModel) => {
					if (parentWindow) {
						focus(parentWindow.uid);
					}

					if (!entry) {
						return;
					}

					handleChange(
						'address',
						displayAddressLabel(entry, language),
					);
					handleChange('address_id', entry.id);
					setSearchAddress('');

					await queryClient.invalidateQueries({
						queryKey: [ADDRESS_SUGGESTIONS_KEY],
					});
				},
			},
		});
	};

	return (
		<>
			{/* Fixed by the manager that opened the window - a client address cannot change client */}
			<input
				type="hidden"
				name="client_id"
				value={formValues.client_id ?? ''}
			/>

			<FormComponentRadio<ClientAddressFormValuesType>
				labelText="Type"
				id={elementIds.type}
				fieldName="type"
				fieldValue={formValues.type}
				options={clientAddressTypes}
				disabled={pending}
				onChange={(value) =>
					handleChange('type', value as ClientAddressType)
				}
				error={errors.type}
			/>

			{/*
			 * The id is what the backend takes; the visible box carries the label only. Typing
			 * clears the id, so only a picked or newly created address validates.
			 */}
			<input
				type="hidden"
				name="address_id"
				value={formValues.address_id ?? ''}
			/>
			<FormComponentAutoComplete<
				ClientAddressFormValuesType,
				AddressModel
			>
				labelText="Address"
				id={elementIds.address}
				fieldName="address"
				fieldValue={formValues.address ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.address_id ?? errors.address}
				onInputChange={(value) => {
					handleChange('address', value);
					handleChange('address_id', null);
					setSearchAddress(value);
				}}
				autoCompleteProps={{
					suggestions: addressSuggestions,
					isLoading: isAddressFetching,
					onSelect: (address) => {
						handleChange(
							'address',
							displayAddressLabel(address, language),
						);
						handleChange('address_id', address.id);
					},
					getOptionLabel: (address) =>
						address.postal_code
							? `${displayAddressLabel(address, language)}, ${address.postal_code}`
							: displayAddressLabel(address, language),
					getOptionKey: (address) => address.id,

					allowCreate: canCreateAddress,
					onCreate: createAddress,
					createLabel: (value) => `Create address "${value}"`,
				}}
				icons={{
					left: <Icons.Address className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentInput<ClientAddressFormValuesType>
				labelText="Details"
				id={elementIds.details}
				fieldName="details"
				fieldValue={formValues.details ?? ''}
				isRequired={false}
				placeholderText="e.g.: Ap. 12, floor 3"
				disabled={pending}
				onChange={(e) => handleChange('details', e.target.value)}
				error={errors.details}
			/>

			<FormComponentTextarea<ClientAddressFormValuesType>
				labelText="Notes"
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				isRequired={false}
				placeholderText="e.g.: Ring twice, entrance from the back"
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
				rows={3}
			/>
		</>
	);
}
