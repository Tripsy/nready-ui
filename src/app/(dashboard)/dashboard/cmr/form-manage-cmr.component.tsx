import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentInput,
	FormComponentRadio,
	FormComponentTextarea,
	FormComponentTime,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { getLanguageClient } from '@/config/translate.setup';
import { createCurrentDate } from '@/helpers/date.helper';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { type AddressModel, displayAddressLabel } from '@/models/address.model';
import {
	type ClientModel,
	ClientStatusEnum,
	ClientTypeEnum,
	displayClientLabel,
} from '@/models/client.model';
import {
	type CmrTransportType,
	CmrTransportTypeEnum,
} from '@/models/cmr.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { useModalStore } from '@/stores/window.store';
import type { FindFunctionResponseType } from '@/types/action.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export type CmrFormValuesType = {
	transport_type: CmrTransportType;
	client_id: number | null;
	client: string | null;
	pickup_address_id: number | null;
	pickup_address: string | null;
	delivery_address_id: number | null;
	delivery_address: string | null;
	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
	ordered_at: string | null;
	ordered_at_time: string | null;
	pick_scheduled_at: string | null;
	pick_scheduled_at_time: string | null;
	estimated_delivery_at: string | null;
	estimated_delivery_at_time: string | null;
	delivered_at: string | null;
	delivered_at_time: string | null;
	notes: string | null;
};

const transportTypes = toOptionsFromEnum(CmrTransportTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageCmr() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<CmrFormValuesType>();

	const queryClient = useQueryClient();

	const { open, focus, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();

	const elementIds = useElementIds([
		'transport_type',
		'client',
		'pickup_address',
		'delivery_address',
		'contact_name',
		'contact_name',
		'contact_email',
		'contact_phone',
		'ordered_at',
		'ordered_at_time',
		'pick_scheduled_at',
		'pick_scheduled_at_time',
		'estimated_delivery_at',
		'estimated_delivery_at_time',
		'delivered_at',
		'delivered_at_time',
		'notes',
	] as const);

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

	const invalidateClientSuggestions = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['s-client'],
			}),
		[queryClient],
	);

	const [searchPickupAddress, setSearchPickupAddress] = useState('');

	const {
		suggestions: pickupAddressSuggestions,
		isFetching: isPickupAddressFetching,
	} = useRemoteAutocomplete<AddressModel>({
		query: searchPickupAddress,
		queryKey: ['s-address'],
		queryFn: async (q) => {
			const res: FindFunctionResponseType<AddressModel> | undefined =
				await requestFind('address', {
					filter: {
						term: q,
					},
					limit: 10,
				});

			return res?.entries ?? [];
		},
		minLength: 3,
	});

	const [searchDeliveryAddress, setSearchDeliveryAddress] = useState('');

	const {
		suggestions: deliveryAddressSuggestions,
		isFetching: isDeliveryAddressFetching,
	} = useRemoteAutocomplete<AddressModel>({
		query: searchDeliveryAddress,
		queryKey: ['s-address'],
		queryFn: async (q) => {
			const res: FindFunctionResponseType<AddressModel> | undefined =
				await requestFind('address', {
					filter: {
						term: q,
					},
					limit: 10,
				});

			return res?.entries ?? [];
		},
		minLength: 3,
	});

	const invalidateAddressSuggestions = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ['s-address'],
			}),
		[queryClient],
	);

	const maxOrderAtDate = createCurrentDate();
	const language = getLanguageClient();

	return (
		<>
			<FormComponentRadio<CmrFormValuesType>
				labelText="Type"
				id={elementIds.transport_type}
				fieldName="transport_type"
				fieldValue={formValues.transport_type}
				options={transportTypes}
				disabled={pending}
				onChange={(value) =>
					handleChange('transport_type', value as CmrTransportType)
				}
				error={errors.transport_type}
			/>

			<input
				type="hidden"
				name="client_id"
				value={formValues.client_id ?? ''}
			/>

			<FormComponentAutoComplete<CmrFormValuesType, ClientModel>
				labelText="Client"
				id={elementIds.client}
				fieldName="client"
				fieldValue={formValues.client ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.client}
				onInputChange={(value) => {
					handleChange('client', value);
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

					allowCreate: true,

					onCreate: (value) => {
						open({
							section: DataSourceSectionEnum.DASHBOARD,
							dataSource: 'client',
							action: 'create',
							minimized: false,
							data: {
								prefillEntry: {
									client_type: ClientTypeEnum.COMPANY,
									company_name: value,
								},
							},
							events: {
								success: async (client?: ClientModel) => {
									if (!client) {
										return;
									}

									handleChange(
										'client',
										displayClientLabel(client),
									);
									handleChange('client_id', client.id);

									await invalidateClientSuggestions();

									// Back to form
									if (windowConfig) {
										focus(windowConfig.uid);
									}
								},
							},
							props: {
								size: 'x2l',
							},
						});
					},
					createLabel: (value) => `Create client "${value}"`,
				}}
				icons={{
					left: <Icons.Client className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<input
				type="hidden"
				name="pickup_address_id"
				value={formValues.pickup_address_id ?? ''}
			/>

			<FormComponentAutoComplete<CmrFormValuesType, AddressModel>
				labelText="Pickup Address"
				id={elementIds.pickup_address}
				fieldName="pickup_address"
				fieldValue={formValues.pickup_address ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.pickup_address}
				onInputChange={(value) => {
					handleChange('pickup_address', value);
					handleChange('pickup_address_id', null);
					setSearchPickupAddress(value);
				}}
				autoCompleteProps={{
					suggestions: pickupAddressSuggestions,
					isLoading: isPickupAddressFetching,
					onSelect: (m) => {
						handleChange(
							'pickup_address',
							displayAddressLabel(m, language),
						);
						handleChange('pickup_address_id', m.id);
					},
					getOptionLabel: (m) => displayAddressLabel(m, language),
					getOptionKey: (m) => m.id,

					allowCreate: true,

					onCreate: (value) => {
						open({
							section: DataSourceSectionEnum.DASHBOARD,
							dataSource: 'address',
							action: 'create',
							minimized: false,
							data: {
								prefillEntry: {
									details: value,
								},
							},
							events: {
								success: async (address?: AddressModel) => {
									if (!address) {
										return;
									}

									handleChange(
										'pickup_address',
										displayAddressLabel(address, language),
									);
									handleChange(
										'pickup_address_id',
										address.id,
									);

									await invalidateAddressSuggestions();

									// Back to form
									if (windowConfig) {
										focus(windowConfig.uid);
									}
								},
							},
							props: {
								size: 'x2l',
							},
						});
					},
					createLabel: () => `Create address`,
				}}
				icons={{
					left: <Icons.Address className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<input
				type="hidden"
				name="delivery_address_id"
				value={formValues.delivery_address_id ?? ''}
			/>

			<FormComponentAutoComplete<CmrFormValuesType, AddressModel>
				labelText="Delivery Address"
				id={elementIds.delivery_address}
				fieldName="delivery_address"
				fieldValue={formValues.delivery_address ?? ''}
				className="pl-8"
				isRequired={true}
				disabled={pending}
				error={errors.delivery_address}
				onInputChange={(value) => {
					handleChange('delivery_address', value);
					handleChange('delivery_address_id', null);
					setSearchDeliveryAddress(value);
				}}
				autoCompleteProps={{
					suggestions: deliveryAddressSuggestions,
					isLoading: isDeliveryAddressFetching,
					onSelect: (m) => {
						handleChange(
							'delivery_address',
							displayAddressLabel(m, language),
						);
						handleChange('delivery_address_id', m.id);
					},
					getOptionLabel: (m) => displayAddressLabel(m, language),
					getOptionKey: (m) => m.id,

					allowCreate: true,

					onCreate: (value) => {
						open({
							section: DataSourceSectionEnum.DASHBOARD,
							dataSource: 'address',
							action: 'create',
							minimized: false,
							data: {
								prefillEntry: {
									details: value,
								},
							},
							events: {
								success: async (address?: AddressModel) => {
									if (!address) {
										return;
									}

									handleChange(
										'delivery_address',
										displayAddressLabel(address, language),
									);
									handleChange(
										'delivery_address_id',
										address.id,
									);

									await invalidateAddressSuggestions();

									// Back to form
									if (windowConfig) {
										focus(windowConfig.uid);
									}
								},
							},
							props: {
								size: 'x2l',
							},
						});
					},
					createLabel: () => `Create address`,
				}}
				icons={{
					left: <Icons.Address className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<div className="grid sm:grid-cols-3 gap-4">
				<FormComponentInput<CmrFormValuesType>
					labelText="Contact - Name"
					id={elementIds.contact_name}
					fieldName="contact_name"
					fieldValue={formValues.contact_name ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) =>
						handleChange('contact_name', e.target.value)
					}
					error={errors.contact_name}
				/>

				<FormComponentInput<CmrFormValuesType>
					labelText="Contact - Email"
					id={elementIds.contact_email}
					fieldName="contact_email"
					fieldValue={formValues.contact_email ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) =>
						handleChange('contact_email', e.target.value)
					}
					error={errors.contact_email}
				/>

				<FormComponentInput<CmrFormValuesType>
					labelText="Contact - Phone"
					id={elementIds.contact_phone}
					fieldName="contact_phone"
					fieldValue={formValues.contact_phone ?? ''}
					isRequired={false}
					disabled={pending}
					onChange={(e) =>
						handleChange('contact_phone', e.target.value)
					}
					error={errors.contact_phone}
				/>
			</div>

			<div className="flex flex-wrap gap-4">
				<div className="flex flex-wrap gap-2">
					<FormComponentCalendar<CmrFormValuesType>
						labelText="Order Date"
						id={elementIds.ordered_at}
						fieldName="ordered_at"
						fieldValue={formValues.ordered_at ?? ''}
						disabled={pending}
						onSelect={(value) => handleChange('ordered_at', value)}
						maxDate={maxOrderAtDate}
						error={errors.ordered_at}
					/>

					<FormComponentTime<CmrFormValuesType>
						labelText="Order Time"
						id={elementIds.ordered_at_time}
						fieldName="ordered_at_time"
						fieldValue={formValues.ordered_at_time ?? ''}
						placeholderText="e.g.: 10:30"
						disabled={pending}
						onChange={(e) =>
							handleChange('ordered_at_time', e.target.value)
						}
						error={errors.ordered_at_time}
						minuteInterval={5}
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<FormComponentCalendar<CmrFormValuesType>
						labelText="Pick Scheduled Date"
						id={elementIds.pick_scheduled_at}
						fieldName="pick_scheduled_at"
						fieldValue={formValues.pick_scheduled_at ?? ''}
						disabled={pending}
						onSelect={(value) =>
							handleChange('pick_scheduled_at', value)
						}
						error={errors.pick_scheduled_at}
					/>

					<FormComponentTime<CmrFormValuesType>
						labelText="Pick Scheduled Time"
						id={elementIds.pick_scheduled_at_time}
						fieldName="pick_scheduled_at_time"
						fieldValue={formValues.pick_scheduled_at_time ?? ''}
						placeholderText="e.g.: 10:30"
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'pick_scheduled_at_time',
								e.target.value,
							)
						}
						error={errors.pick_scheduled_at_time}
						minuteInterval={5}
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<FormComponentCalendar<CmrFormValuesType>
						labelText="Estimated Delivery Date"
						id={elementIds.estimated_delivery_at}
						fieldName="estimated_delivery_at"
						fieldValue={formValues.estimated_delivery_at ?? ''}
						disabled={pending}
						onSelect={(value) =>
							handleChange('estimated_delivery_at', value)
						}
						error={errors.estimated_delivery_at}
					/>

					<FormComponentTime<CmrFormValuesType>
						labelText="Estimated Delivery Time"
						id={elementIds.estimated_delivery_at_time}
						fieldName="estimated_delivery_at_time"
						fieldValue={formValues.estimated_delivery_at_time ?? ''}
						placeholderText="e.g.: 10:30"
						disabled={pending}
						onChange={(e) =>
							handleChange(
								'estimated_delivery_at_time',
								e.target.value,
							)
						}
						error={errors.estimated_delivery_at_time}
						minuteInterval={5}
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<FormComponentCalendar<CmrFormValuesType>
						labelText="Delivered Date"
						id={elementIds.delivered_at}
						fieldName="delivered_at"
						fieldValue={formValues.delivered_at ?? ''}
						disabled={pending}
						onSelect={(value) =>
							handleChange('delivered_at', value)
						}
						error={errors.delivered_at}
					/>

					<FormComponentTime<CmrFormValuesType>
						labelText="Delivered Time"
						id={elementIds.delivered_at_time}
						fieldName="delivered_at_time"
						fieldValue={formValues.delivered_at_time ?? ''}
						placeholderText="e.g.: 10:30"
						disabled={pending}
						onChange={(e) =>
							handleChange('delivered_at_time', e.target.value)
						}
						error={errors.delivered_at_time}
						minuteInterval={5}
					/>
				</div>
			</div>

			<FormComponentTextarea<CmrFormValuesType>
				labelText="Notes"
				id={elementIds.notes}
				fieldName="notes"
				fieldValue={formValues.notes ?? ''}
				isRequired={false}
				disabled={pending}
				onChange={(e) => handleChange('notes', e.target.value)}
				error={errors.notes}
				rows={4}
			/>
		</>
	);
}
