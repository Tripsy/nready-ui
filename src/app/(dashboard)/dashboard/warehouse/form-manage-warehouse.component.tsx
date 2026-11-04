'use client';

import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type AddressModel, displayAddressLabel } from '@/models/address.model';
import { WAREHOUSE_CODE_MAX_LENGTH } from '@/models/warehouse.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

const TRANSLATION_KEYS = [
	'warehouse.field.address',
	'warehouse.field.code',
	'warehouse.field.is_default',
	'warehouse.field.name',
	'warehouse.field.notes',
	'warehouse.text.placeholder_code',
	'warehouse.text.placeholder_name',
	'warehouse.text.default_warehouse',
] as const;

export type WarehouseFormValuesType = {
	address_id: number | null;
	/** The autocomplete's visible text. Submitted as `address_label` and never sent on. */
	address: string | null;
	code: string | null;
	name: string | null;
	is_default: boolean;
	notes: string | null;
};

export function FormManageWarehouse() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<WarehouseFormValuesType>();

	const elementIds = useElementIds([
		'address',
		'code',
		'name',
		'is_default',
		'notes',
	] as const);

	const language = getLanguageClient();

	const [searchAddress, setSearchAddress] = useState('');

	const { suggestions: addressSuggestions, isFetching: isAddressFetching } =
		useRemoteAutocomplete<AddressModel>({
			query: searchAddress,
			queryKey: ['s-warehouse-address'],
			queryFn: async (q) => {
				const res: FindFunctionResponseType<AddressModel> | undefined =
					await requestFind('address', {
						filter: { term: q },
						limit: 10,
					});

				return res?.entries ?? [];
			},
			minLength: 3,
		});

	return (
		<>
			{/*
			 * The id is what the backend takes; the visible box carries the label only. Both are
			 * submitted so a failed validation redraws the box with the address already picked.
			 */}
			<input
				type="hidden"
				name="address_id"
				value={formValues.address_id ?? ''}
			/>
			<input
				type="hidden"
				name="address_label"
				value={formValues.address ?? ''}
			/>
			<FormComponentAutoComplete<WarehouseFormValuesType, AddressModel>
				labelText={translations['warehouse.field.address']}
				id={elementIds.address}
				fieldName="address"
				fieldValue={formValues.address ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.address_id}
				onInputChange={(value) => {
					handleChange('address', value);
					// Clearing the id with the text stops an edited label from keeping the
					// previously picked address silently attached
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
						displayAddressLabel(address, language),
					getOptionKey: (address) => address.id,
				}}
				icons={{
					left: <Icons.Address className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<FormComponentInput<WarehouseFormValuesType>
				labelText={translations['warehouse.field.code']}
				id={elementIds.code}
				fieldName="code"
				fieldValue={formValues.code ?? ''}
				isRequired={true}
				placeholderText={replaceVars(
					translations['warehouse.text.placeholder_code'],
					{ max: WAREHOUSE_CODE_MAX_LENGTH },
				)}
				disabled={pending}
				onChange={(e) => handleChange('code', e.target.value)}
				error={errors.code}
			/>

			<FormComponentInput<WarehouseFormValuesType>
				labelText={translations['warehouse.field.name']}
				id={elementIds.name}
				fieldName="name"
				fieldValue={formValues.name ?? ''}
				isRequired={true}
				placeholderText={
					translations['warehouse.text.placeholder_name']
				}
				disabled={pending}
				onChange={(e) => handleChange('name', e.target.value)}
				error={errors.name}
			/>

			<FormComponentCheckbox<WarehouseFormValuesType>
				id={elementIds.is_default}
				fieldName="is_default"
				checked={formValues.is_default}
				disabled={pending}
				onCheckedChange={(checked) =>
					handleChange('is_default', checked)
				}
				error={errors.is_default}
			>
				{translations['warehouse.text.default_warehouse']}
			</FormComponentCheckbox>

			<FormComponentTextarea<WarehouseFormValuesType>
				labelText={translations['warehouse.field.notes']}
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				isRequired={false}
				rows={3}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
			/>
		</>
	);
}
