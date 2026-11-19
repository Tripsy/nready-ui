'use client';

import { useMemo, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type CarrierModel, displayCarrierLabel } from '@/models/carrier.model';
import {
	type ClientAddressModel,
	displayClientAddressLabel,
} from '@/models/client-address.model';
import { ShippingMethodEnum } from '@/models/shipping.model';
import {
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';

const TRANSLATION_KEYS = [
	'order-return.field.destination_warehouse',
	'order-return.field.pickup_address',
	'order-return.field.carrier',
	'order-return.field.method',
	'order-return.field.price',
	'order-return.field.vat_rate',
	'order-return.field.response',
	'order-return.text.approve_hint',
	'order-return.text.placeholder_destination',
	'order-return.text.placeholder_pickup',
	'order-return.text.placeholder_free',
	'order-return.text.placeholder_response',
	...enumTranslationKeys('order-return.enum.method', ShippingMethodEnum),
] as const;

export type OrderReturnApproveFormValuesType = {
	destination_warehouse_id: number | null;
	pickup_client_address_id: number | null;
	carrier_id: number | null;
	method: string | null;
	price: number | null;
	vat_rate: number | null;
	response: string | null;
	// display-only fields, not part of validation
	/** The autocompletes' visible text. Submitted as `*_label` and never sent on. */
	destination_warehouse: string | null;
	pickup_client_address: string | null;
	carrier: string | null;
	/** The client the order is billed to - narrows the pickup address picker. Never sent. */
	client_id: number | null;
};

/**
 * Approving a request writes its return shipment, so this asks only what the backend cannot
 * default. Left empty, the goods go back to the warehouse they left from, are collected at the
 * address the delivery went to and travel free. A pickup address is needed only when the order
 * was collected in person - there is no delivery address to come back from.
 */
export function FormApproveOrderReturn() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<OrderReturnApproveFormValuesType>();

	const elementIds = useElementIds([
		'destination_warehouse',
		'pickup_client_address',
		'carrier',
		'method',
		'price',
		'vat_rate',
		'response',
	] as const);

	const methods = useMemo(
		() =>
			toOptionsFromEnum(ShippingMethodEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'order-return.enum.method',
						value,
					),
			}),
		[translations],
	);

	const [searchWarehouse, setSearchWarehouse] = useState('');
	const [searchAddress, setSearchAddress] = useState('');
	const [searchCarrier, setSearchCarrier] = useState('');

	const {
		suggestions: warehouseSuggestions,
		isFetching: isWarehouseFetching,
	} = useRemoteAutocomplete<WarehouseModel>({
		query: searchWarehouse,
		queryKey: ['s-order-return-warehouse'],
		queryFn: async (term) => {
			const response:
				| FindFunctionResponseType<WarehouseModel>
				| undefined = await requestFind('warehouse', {
				filter: { term: term },
				limit: 10,
			});

			return response?.entries ?? [];
		},
		minLength: 3,
	});

	const { suggestions: addressSuggestions, isFetching: isAddressFetching } =
		useRemoteAutocomplete<ClientAddressModel>({
			query: searchAddress,
			queryKey: ['s-order-return-address', formValues.client_id],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<ClientAddressModel>
					| undefined = await requestFind('client-address', {
					filter: {
						term: term,
						...(formValues.client_id
							? { client_id: formValues.client_id }
							: {}),
					},
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	const { suggestions: carrierSuggestions, isFetching: isCarrierFetching } =
		useRemoteAutocomplete<CarrierModel>({
			query: searchCarrier,
			queryKey: ['s-order-return-carrier'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<CarrierModel>
					| undefined = await requestFind('carrier', {
					filter: { term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	const language = getLanguageClient();

	return (
		<div className="form-section">
			<p className="text-sm text-muted">
				{translations['order-return.text.approve_hint']}
			</p>

			<input
				type="hidden"
				name="client_id"
				value={formValues.client_id ?? ''}
			/>

			<input
				type="hidden"
				name="destination_warehouse_id"
				value={formValues.destination_warehouse_id ?? ''}
			/>
			<input
				type="hidden"
				name="destination_warehouse_label"
				value={formValues.destination_warehouse ?? ''}
			/>
			<FormComponentAutoComplete<
				OrderReturnApproveFormValuesType,
				WarehouseModel
			>
				labelText={
					translations['order-return.field.destination_warehouse']
				}
				id={elementIds.destination_warehouse}
				fieldName="destination_warehouse"
				fieldValue={formValues.destination_warehouse ?? ''}
				placeholderText={
					translations['order-return.text.placeholder_destination']
				}
				className="pl-8"
				isRequired={false}
				disabled={pending}
				error={errors.destination_warehouse_id}
				onInputChange={(value) => {
					handleChange('destination_warehouse', value);
					handleChange('destination_warehouse_id', null);
					setSearchWarehouse(value);
				}}
				autoCompleteProps={{
					suggestions: warehouseSuggestions,
					isLoading: isWarehouseFetching,
					onSelect: (warehouse) => {
						handleChange(
							'destination_warehouse',
							displayWarehouseLabel(warehouse),
						);
						handleChange('destination_warehouse_id', warehouse.id);
					},
					getOptionLabel: (warehouse) =>
						displayWarehouseLabel(warehouse),
					getOptionKey: (warehouse) => warehouse.id,
				}}
				icons={{
					left: (
						<Icons.Warehouse className="opacity-40 h-4.5 w-4.5" />
					),
				}}
			/>

			<input
				type="hidden"
				name="pickup_client_address_id"
				value={formValues.pickup_client_address_id ?? ''}
			/>
			<input
				type="hidden"
				name="pickup_client_address_label"
				value={formValues.pickup_client_address ?? ''}
			/>
			<FormComponentAutoComplete<
				OrderReturnApproveFormValuesType,
				ClientAddressModel
			>
				labelText={translations['order-return.field.pickup_address']}
				id={elementIds.pickup_client_address}
				fieldName="pickup_client_address"
				fieldValue={formValues.pickup_client_address ?? ''}
				placeholderText={
					translations['order-return.text.placeholder_pickup']
				}
				className="pl-8"
				isRequired={false}
				disabled={pending}
				error={errors.pickup_client_address_id}
				onInputChange={(value) => {
					handleChange('pickup_client_address', value);
					handleChange('pickup_client_address_id', null);
					setSearchAddress(value);
				}}
				autoCompleteProps={{
					suggestions: addressSuggestions,
					isLoading: isAddressFetching,
					onSelect: (address) => {
						handleChange(
							'pickup_client_address',
							displayClientAddressLabel(address, language),
						);
						handleChange('pickup_client_address_id', address.id);
					},
					getOptionLabel: (address) =>
						displayClientAddressLabel(address, language),
					getOptionKey: (address) => address.id,
				}}
				icons={{
					left: <Icons.Address className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<div className="flex flex-wrap gap-4">
				<FormComponentSelect<OrderReturnApproveFormValuesType>
					labelText={translations['order-return.field.method']}
					id={elementIds.method}
					fieldName="method"
					fieldValue={formValues.method ?? ''}
					isRequired={true}
					disabled={pending}
					className="w-48"
					options={methods}
					onChange={(value) => handleChange('method', value)}
					error={errors.method}
				/>

				<input
					type="hidden"
					name="carrier_id"
					value={formValues.carrier_id ?? ''}
				/>
				<input
					type="hidden"
					name="carrier_label"
					value={formValues.carrier ?? ''}
				/>
				<FormComponentAutoComplete<
					OrderReturnApproveFormValuesType,
					CarrierModel
				>
					labelText={translations['order-return.field.carrier']}
					id={elementIds.carrier}
					fieldName="carrier"
					fieldValue={formValues.carrier ?? ''}
					className="pl-8"
					isRequired={false}
					disabled={pending}
					error={errors.carrier_id}
					onInputChange={(value) => {
						handleChange('carrier', value);
						handleChange('carrier_id', null);
						setSearchCarrier(value);
					}}
					autoCompleteProps={{
						suggestions: carrierSuggestions,
						isLoading: isCarrierFetching,
						onSelect: (carrier) => {
							handleChange(
								'carrier',
								displayCarrierLabel(carrier),
							);
							handleChange('carrier_id', carrier.id);
						},
						getOptionLabel: (carrier) =>
							displayCarrierLabel(carrier),
						getOptionKey: (carrier) => carrier.id,
					}}
					icons={{
						left: (
							<Icons.Carrier className="opacity-40 h-4.5 w-4.5" />
						),
					}}
				/>
			</div>

			<div className="flex flex-wrap gap-4">
				<FormComponentInput<OrderReturnApproveFormValuesType>
					labelText={translations['order-return.field.price']}
					id={elementIds.price}
					fieldName="price"
					fieldValue={formValues.price ?? ''}
					placeholderText={
						translations['order-return.text.placeholder_free']
					}
					isRequired={false}
					disabled={pending}
					className="w-40"
					onChange={(e) =>
						handleChange(
							'price',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.price}
				/>
				<FormComponentInput<OrderReturnApproveFormValuesType>
					labelText={translations['order-return.field.vat_rate']}
					id={elementIds.vat_rate}
					fieldName="vat_rate"
					fieldValue={formValues.vat_rate ?? ''}
					isRequired={false}
					disabled={pending}
					className="w-32"
					onChange={(e) =>
						handleChange(
							'vat_rate',
							e.target.value === ''
								? null
								: Number(e.target.value),
						)
					}
					error={errors.vat_rate}
				/>
			</div>

			<FormComponentTextarea<OrderReturnApproveFormValuesType>
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
		</div>
	);
}
