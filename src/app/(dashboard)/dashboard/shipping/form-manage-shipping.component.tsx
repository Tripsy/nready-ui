import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import {
	countErrorMessages,
	ownErrorMessages,
	toOptionsFromEnum,
} from '@/helpers/form.helper';
import { requestFind, requestView } from '@/helpers/services.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import type { CarrierModel } from '@/models/carrier.model';
import type { ClientAddressModel } from '@/models/client-address.model';
import {
	displayOrderReference,
	type OrderLineModel,
	type OrderModel,
} from '@/models/order.model';
import {
	SHIPPING_SCOPE_SHAPE,
	ShippingMethodEnum,
	type ShippingScope,
	ShippingScopeEnum,
} from '@/models/shipping.model';
import {
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import { CurrencyEnum } from '@/types/common.type';

/** The books are kept in one currency, which is what `operational_cost` is entered in. */
const BASE_CURRENCY = Configuration.get('app.currency');

/** One line as the form holds it, before it is sent as part of the `lines` payload. */
export type ShippingLineFormType = {
	variant_id: number;
	product_id: number;
	quantity: number | null;
	notes: string | null;
};

export type ShippingFormValuesType = {
	scope: string | null;
	order_id: number | null;
	document_ref: number | null;
	pickup_warehouse_id: number | null;
	pickup_client_address_id: number | null;
	destination_warehouse_id: number | null;
	destination_client_address_id: number | null;
	carrier_id: number | null;
	method: string | null;
	tracking_number: string | null;
	tracking_url: string | null;
	price: number | null;
	operational_cost: number | null;
	vat_rate: number | null;
	currency: string | null;
	contact_name: string | null;
	contact_phone: string | null;
	contact_email: string | null;
	estimated_delivery_at: string | null;
	notes: string | null;
	lines: ShippingLineFormType[];
	// display-only fields, not part of validation
	/** The autocompletes' visible text. Submitted as `*_label` and never sent on. */
	order: string | null;
	pickup_warehouse: string | null;
	pickup_client_address: string | null;
	destination_warehouse: string | null;
	destination_client_address: string | null;
	carrier: string | null;
	/**
	 * Whether the row already exists. The scope is fixed at creation - the backend drops one sent on
	 * an update - so the picker is shown only while it can still be chosen.
	 */
	is_existing: boolean;
};

const currencies = toOptionsFromEnum(CurrencyEnum);

const methods = toOptionsFromEnum(ShippingMethodEnum, {
	formatter: formatEnumLabel,
});

const scopes = toOptionsFromEnum(ShippingScopeEnum, {
	formatter: formatEnumLabel,
});

/**
 * What travels, by variant.
 *
 * With an order behind the movement the variants come from the order itself, so an operator picks
 * quantities rather than typing ids - the same screen that splits an order across two warehouses.
 * A `relocation` has no order, and choosing arbitrary stock to move needs the relocation document
 * that does not exist yet, so the editor says so rather than offering a picker that cannot be
 * validated.
 *
 * A row left at zero is simply not carried. The backend owns the real rule: a quantity above what
 * the order still has unshipped for that variant comes back as a 409, because what another movement
 * already claimed is not knowable from this form alone.
 */
function ShippingLinesEditor({
	orderId,
	scope,
	lines,
	disabled,
	error,
	onChange,
}: {
	readonly orderId: number | null;
	readonly scope: ShippingScope | null;
	readonly lines: ShippingLineFormType[];
	readonly disabled: boolean;
	readonly error: string[] | undefined;
	readonly onChange: (lines: ShippingLineFormType[]) => void;
}) {
	const { data: orderLines, isLoading } = useQuery({
		queryKey: ['shipping-order-lines', orderId],
		queryFn: async (): Promise<OrderLineModel[]> => {
			if (!orderId) {
				return [];
			}

			const order = await requestView<OrderModel>('order', orderId);

			return order?.lines ?? [];
		},
		enabled: !!orderId,
	});

	if (scope === ShippingScopeEnum.RELOCATION) {
		return (
			<p className="text-sm text-muted">
				A relocation is measured against stock on hand rather than an
				order, and the document behind it does not exist yet - so its
				contents cannot be chosen here.
			</p>
		);
	}

	if (!orderId) {
		return (
			<p className="text-sm text-muted">
				Pick an order first - its lines are what this movement is filled
				from.
			</p>
		);
	}

	if (isLoading) {
		return <p className="text-sm text-muted">Loading order lines...</p>;
	}

	if (!orderLines || orderLines.length === 0) {
		return <p className="text-sm text-muted">This order has no lines.</p>;
	}

	const quantityFor = (variantId: number): number | null =>
		lines.find((line) => line.variant_id === variantId)?.quantity ?? null;

	const setQuantity = (
		variantId: number,
		productId: number,
		value: string,
	) => {
		const quantity = value === '' ? null : Number(value);

		const without = lines.filter((line) => line.variant_id !== variantId);

		if (quantity === null || quantity <= 0) {
			onChange(without);

			return;
		}

		onChange([
			...without,
			{
				variant_id: variantId,
				product_id: productId,
				quantity: quantity,
				notes: null,
			},
		]);
	};

	return (
		<div className="flex flex-col gap-3">
			{orderLines.map((orderLine) => (
				<div
					key={orderLine.id}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
				>
					<div className="min-w-0 flex-1">
						<div className="font-medium">
							{orderLine.label ??
								`Variant #${orderLine.variant_id}`}
						</div>
						<div className="text-xs text-muted">
							Ordered {orderLine.quantity}
						</div>
					</div>

					<FormComponentInput<ShippingLineFormType>
						labelText="Ships now"
						id={`shipping-line-${orderLine.variant_id}`}
						fieldName="quantity"
						fieldValue={quantityFor(orderLine.variant_id) ?? ''}
						isRequired={false}
						disabled={disabled}
						className="w-32"
						placeholderText="0"
						onChange={(e) =>
							setQuantity(
								orderLine.variant_id,
								orderLine.product_id,
								e.target.value,
							)
						}
					/>
				</div>
			))}

			{error?.map((message) => (
				<p key={message} className="text-sm text-error">
					{message}
				</p>
			))}
		</div>
	);
}

const FORM_TABS = [
	{ id: 'details', label: 'Details' },
	{ id: 'lines', label: 'Lines' },
] as const;

type FormTabId = (typeof FORM_TABS)[number]['id'];

/** Which tab owns which field, for the error badge on the tab strip. */
const TAB_FIELDS: Record<FormTabId, readonly (keyof ShippingFormValuesType)[]> =
	{
		details: [
			'scope',
			'order_id',
			'document_ref',
			'pickup_warehouse_id',
			'pickup_client_address_id',
			'destination_warehouse_id',
			'destination_client_address_id',
			'carrier_id',
			'method',
			'tracking_number',
			'tracking_url',
			'price',
			'operational_cost',
			'vat_rate',
			'currency',
			'contact_name',
			'contact_phone',
			'contact_email',
			'estimated_delivery_at',
			'notes',
		],
		lines: ['lines'],
	};

export function FormManageShipping() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<ShippingFormValuesType>();

	const elementIds = useElementIds([
		'scope',
		'order',
		'document_ref',
		'pickup_warehouse',
		'pickup_client_address',
		'destination_warehouse',
		'destination_client_address',
		'carrier',
		'method',
		'tracking_number',
		'tracking_url',
		'price',
		'operational_cost',
		'vat_rate',
		'currency',
		'contact_name',
		'contact_phone',
		'contact_email',
		'estimated_delivery_at',
		'notes',
	] as const);

	const isCollected =
		formValues.scope === ShippingScopeEnum.DELIVERY &&
		formValues.method === ShippingMethodEnum.SELF_PICKUP;

	const [searchOrder, setSearchOrder] = useState('');
	const [searchPickupWarehouse, setSearchPickupWarehouse] = useState('');
	const [searchDestinationWarehouse, setSearchDestinationWarehouse] =
		useState('');
	const [searchPickupAddress, setSearchPickupAddress] = useState('');
	const [searchDestinationAddress, setSearchDestinationAddress] =
		useState('');
	const [searchCarrier, setSearchCarrier] = useState('');

	const scope = (formValues.scope as ShippingScope | null) ?? null;
	const shape = scope ? SHIPPING_SCOPE_SHAPE[scope] : null;

	const { suggestions: orderSuggestions, isFetching: isOrderFetching } =
		useRemoteAutocomplete<OrderModel>({
			query: searchOrder,
			queryKey: ['s-shipping-order'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<OrderModel>
					| undefined = await requestFind('order', {
					filter: { term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	const {
		suggestions: pickupWarehouseSuggestions,
		isFetching: isPickupWarehouseFetching,
	} = useRemoteAutocomplete<WarehouseModel>({
		query: searchPickupWarehouse,
		queryKey: ['s-shipping-pickup-warehouse'],
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

	const {
		suggestions: destinationWarehouseSuggestions,
		isFetching: isDestinationWarehouseFetching,
	} = useRemoteAutocomplete<WarehouseModel>({
		query: searchDestinationWarehouse,
		queryKey: ['s-shipping-destination-warehouse'],
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

	const {
		suggestions: pickupAddressSuggestions,
		isFetching: isPickupAddressFetching,
	} = useRemoteAutocomplete<ClientAddressModel>({
		query: searchPickupAddress,
		queryKey: ['s-shipping-pickup-address'],
		queryFn: async (term) => {
			const response:
				| FindFunctionResponseType<ClientAddressModel>
				| undefined = await requestFind('client-address', {
				filter: { term: term },
				limit: 10,
			});

			return response?.entries ?? [];
		},
		minLength: 3,
	});

	const {
		suggestions: destinationAddressSuggestions,
		isFetching: isDestinationAddressFetching,
	} = useRemoteAutocomplete<ClientAddressModel>({
		query: searchDestinationAddress,
		queryKey: ['s-shipping-destination-address'],
		queryFn: async (term) => {
			const response:
				| FindFunctionResponseType<ClientAddressModel>
				| undefined = await requestFind('client-address', {
				filter: { term: term },
				limit: 10,
			});

			return response?.entries ?? [];
		},
		minLength: 3,
	});

	const { suggestions: carrierSuggestions, isFetching: isCarrierFetching } =
		useRemoteAutocomplete<CarrierModel>({
			query: searchCarrier,
			queryKey: ['s-shipping-carrier'],
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

	const lines = formValues.lines ?? [];

	const [tab, setTab] = useState<FormTabId>('details');

	const tabErrors = FORM_TABS.reduce<Record<FormTabId, number>>(
		(counts, { id }) => {
			counts[id] = TAB_FIELDS[id].reduce(
				(total, field) => total + countErrorMessages(errors[field]),
				0,
			);

			return counts;
		},
		{} as Record<FormTabId, number>,
	);

	const warehouseField = (
		side: 'pickup' | 'destination',
	): React.ReactElement => {
		const idField =
			side === 'pickup'
				? ('pickup_warehouse_id' as const)
				: ('destination_warehouse_id' as const);
		const labelField =
			side === 'pickup'
				? ('pickup_warehouse' as const)
				: ('destination_warehouse' as const);

		return (
			<>
				<input
					type="hidden"
					name={idField}
					value={formValues[idField] ?? ''}
				/>
				<input
					type="hidden"
					name={`${labelField}_label`}
					value={formValues[labelField] ?? ''}
				/>
				<FormComponentAutoComplete<
					ShippingFormValuesType,
					WarehouseModel
				>
					labelText={
						side === 'pickup'
							? 'Pickup warehouse'
							: 'Destination warehouse'
					}
					id={elementIds[labelField]}
					fieldName={labelField}
					fieldValue={formValues[labelField] ?? ''}
					className="pl-8"
					isRequired={true}
					disabled={pending}
					error={errors[idField]}
					onInputChange={(value) => {
						handleChange(labelField, value);
						handleChange(idField, null);

						if (side === 'pickup') {
							setSearchPickupWarehouse(value);
						} else {
							setSearchDestinationWarehouse(value);
						}
					}}
					autoCompleteProps={{
						suggestions:
							side === 'pickup'
								? pickupWarehouseSuggestions
								: destinationWarehouseSuggestions,
						isLoading:
							side === 'pickup'
								? isPickupWarehouseFetching
								: isDestinationWarehouseFetching,
						onSelect: (warehouse) => {
							handleChange(
								labelField,
								displayWarehouseLabel(warehouse),
							);
							handleChange(idField, warehouse.id);
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
			</>
		);
	};

	const clientAddressField = (
		side: 'pickup' | 'destination',
	): React.ReactElement => {
		const idField =
			side === 'pickup'
				? ('pickup_client_address_id' as const)
				: ('destination_client_address_id' as const);
		const labelField =
			side === 'pickup'
				? ('pickup_client_address' as const)
				: ('destination_client_address' as const);

		return (
			<>
				<input
					type="hidden"
					name={idField}
					value={formValues[idField] ?? ''}
				/>
				<input
					type="hidden"
					name={`${labelField}_label`}
					value={formValues[labelField] ?? ''}
				/>
				<FormComponentAutoComplete<
					ShippingFormValuesType,
					ClientAddressModel
				>
					labelText={
						side === 'pickup'
							? 'Pickup address'
							: 'Destination address'
					}
					id={elementIds[labelField]}
					fieldName={labelField}
					fieldValue={formValues[labelField] ?? ''}
					className="pl-8"
					isRequired={true}
					disabled={pending}
					error={errors[idField]}
					onInputChange={(value) => {
						handleChange(labelField, value);
						handleChange(idField, null);

						if (side === 'pickup') {
							setSearchPickupAddress(value);
						} else {
							setSearchDestinationAddress(value);
						}
					}}
					autoCompleteProps={{
						suggestions:
							side === 'pickup'
								? pickupAddressSuggestions
								: destinationAddressSuggestions,
						isLoading:
							side === 'pickup'
								? isPickupAddressFetching
								: isDestinationAddressFetching,
						onSelect: (address) => {
							handleChange(labelField, `#${address.id}`);
							handleChange(idField, address.id);
						},
						getOptionLabel: (address) => `#${address.id}`,
						getOptionKey: (address) => address.id,
					}}
					icons={{
						left: (
							<Icons.Address className="opacity-40 h-4.5 w-4.5" />
						),
					}}
				/>
			</>
		);
	};

	return (
		<Tabs
			selectedKey={tab}
			onSelectionChange={(key) => setTab(key as FormTabId)}
			className="w-full"
		>
			<TabsList>
				{FORM_TABS.map(({ id, label }) => (
					<TabsTrigger key={id} id={id}>
						{label}
						{tabErrors[id] > 0 && (
							<span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">
								{tabErrors[id]}
								<span className="sr-only">
									{' '}
									field(s) need attention
								</span>
							</span>
						)}
					</TabsTrigger>
				))}
			</TabsList>

			<TabsContent id="details">
				<div className="form-section">
					{/*
					 * Submitted either way so the pipeline reads it back, but only editable on a
					 * create: the backend fixes the scope at creation and drops one sent on an
					 * update, so offering the picker afterwards would collect a change nothing
					 * applies.
					 */}
					<input
						type="hidden"
						name="is_existing"
						value={formValues.is_existing ? '1' : ''}
					/>
					{formValues.is_existing ? (
						<>
							<input
								type="hidden"
								name="scope"
								value={formValues.scope ?? ''}
							/>
							<p className="text-sm text-muted">
								Movement type:{' '}
								<span className="font-medium">
									{formatEnumLabel(formValues.scope ?? '')}
								</span>{' '}
								- fixed when the movement was created.
							</p>
						</>
					) : (
						<FormComponentSelect<ShippingFormValuesType>
							labelText="Movement type"
							id={elementIds.scope}
							fieldName="scope"
							fieldValue={formValues.scope ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-56"
							options={scopes}
							onChange={(value) => {
								/*
								 * The ends belong to the scope, so switching it clears what the
								 * previous one collected - otherwise a delivery's client address
								 * would ride along into a relocation and be silently dropped.
								 */
								handleChange('scope', value);
								handleChange('pickup_warehouse_id', null);
								handleChange('pickup_warehouse', null);
								handleChange('pickup_client_address_id', null);
								handleChange('pickup_client_address', null);
								handleChange('destination_warehouse_id', null);
								handleChange('destination_warehouse', null);
								handleChange(
									'destination_client_address_id',
									null,
								);
								handleChange(
									'destination_client_address',
									null,
								);
								handleChange('lines', []);
							}}
							error={errors.scope}
						/>
					)}

					{shape?.document === 'order' && (
						<>
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
							<FormComponentAutoComplete<
								ShippingFormValuesType,
								OrderModel
							>
								labelText="Order"
								id={elementIds.order}
								fieldName="order"
								fieldValue={formValues.order ?? ''}
								className="pl-8"
								isRequired={true}
								disabled={pending}
								error={errors.order_id}
								onInputChange={(value) => {
									handleChange('order', value);
									handleChange('order_id', null);
									// The lines are drawn from the order, so a new one starts
									// from an empty set rather than keeping variants that
									// belong to another document
									handleChange('lines', []);
									setSearchOrder(value);
								}}
								autoCompleteProps={{
									suggestions: orderSuggestions,
									isLoading: isOrderFetching,
									onSelect: (order) => {
										handleChange(
											'order',
											displayOrderReference(order),
										);
										handleChange('order_id', order.id);
										handleChange('lines', []);
									},
									getOptionLabel: (order) =>
										displayOrderReference(order),
									getOptionKey: (order) => order.id,
								}}
								icons={{
									left: (
										<Icons.Order className="opacity-40 h-4.5 w-4.5" />
									),
								}}
							/>
						</>
					)}

					{shape?.document === 'document_ref' && (
						<FormComponentInput<ShippingFormValuesType>
							labelText="Document reference"
							id={elementIds.document_ref}
							fieldName="document_ref"
							fieldValue={formValues.document_ref ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-56"
							placeholderText="id of the relocation document"
							onChange={(e) =>
								handleChange(
									'document_ref',
									Number(e.target.value),
								)
							}
							error={errors.document_ref}
						/>
					)}

					{shape?.pickup === 'warehouse' && warehouseField('pickup')}
					{shape?.pickup === 'client_address' &&
						clientAddressField('pickup')}

					{shape?.destination === 'warehouse' &&
						warehouseField('destination')}
					{/*
					 * A self-pickup delivery has no destination - the client collects at the pickup
					 * warehouse - so the backend drops one sent anyway.
					 */}
					{shape?.destination === 'client_address' &&
						!isCollected &&
						clientAddressField('destination')}

					<div className="flex flex-wrap gap-3">
						<FormComponentSelect<ShippingFormValuesType>
							labelText="Method"
							id={elementIds.method}
							fieldName="method"
							fieldValue={formValues.method ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-48"
							options={methods}
							onChange={(value) => {
								handleChange('method', value);

								if (value === ShippingMethodEnum.SELF_PICKUP) {
									handleChange(
										'destination_client_address_id',
										null,
									);
									handleChange(
										'destination_client_address',
										null,
									);
								}
							}}
							error={errors.method}
						/>

						<FormComponentCalendar<ShippingFormValuesType>
							labelText="Estimated Delivery"
							id={elementIds.estimated_delivery_at}
							fieldName="estimated_delivery_at"
							fieldValue={formValues.estimated_delivery_at ?? ''}
							isRequired={false}
							disabled={pending}
							onSelect={(value) =>
								handleChange('estimated_delivery_at', value)
							}
							error={errors.estimated_delivery_at}
						/>
					</div>

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
						ShippingFormValuesType,
						CarrierModel
					>
						labelText="Carrier"
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
								handleChange('carrier', carrier.name);
								handleChange('carrier_id', carrier.id);
							},
							getOptionLabel: (carrier) => carrier.name,
							getOptionKey: (carrier) => carrier.id,
						}}
						icons={{
							left: (
								<Icons.Carrier className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>

					<div className="flex flex-wrap gap-3">
						<FormComponentInput<ShippingFormValuesType>
							labelText="Tracking Number"
							id={elementIds.tracking_number}
							fieldName="tracking_number"
							fieldValue={formValues.tracking_number ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-56"
							onChange={(e) =>
								handleChange('tracking_number', e.target.value)
							}
							error={errors.tracking_number}
						/>

						<FormComponentInput<ShippingFormValuesType>
							labelText="Tracking URL"
							id={elementIds.tracking_url}
							fieldName="tracking_url"
							fieldValue={formValues.tracking_url ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-72"
							onChange={(e) =>
								handleChange('tracking_url', e.target.value)
							}
							error={errors.tracking_url}
						/>
					</div>

					<div className="flex flex-wrap gap-3">
						<FormComponentInput<ShippingFormValuesType>
							labelText="Price"
							id={elementIds.price}
							fieldType="number"
							fieldName="price"
							fieldValue={formValues.price ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-36"
							placeholderText="excl. VAT"
							onChange={(e) =>
								handleChange('price', Number(e.target.value))
							}
							error={errors.price}
						/>

						<FormComponentInput<ShippingFormValuesType>
							labelText="VAT %"
							id={elementIds.vat_rate}
							fieldType="number"
							fieldName="vat_rate"
							fieldValue={formValues.vat_rate ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-28"
							onChange={(e) =>
								handleChange('vat_rate', Number(e.target.value))
							}
							error={errors.vat_rate}
						/>

						<FormComponentSelect<ShippingFormValuesType>
							labelText="Currency"
							id={elementIds.currency}
							fieldName="currency"
							fieldValue={formValues.currency ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-36"
							options={currencies}
							onChange={(value) =>
								handleChange('currency', value)
							}
							error={errors.currency}
						/>

						{/*
						 * Internal, and in the base currency whatever the client is billed in - so
						 * the label names it rather than following the select beside it.
						 */}
						<FormComponentInput<ShippingFormValuesType>
							labelText={`Operational Cost (${BASE_CURRENCY})`}
							id={elementIds.operational_cost}
							fieldType="number"
							fieldName="operational_cost"
							fieldValue={formValues.operational_cost ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-44"
							placeholderText="not recorded"
							onChange={(e) =>
								handleChange(
									'operational_cost',
									e.target.value === ''
										? null
										: Number(e.target.value),
								)
							}
							error={errors.operational_cost}
						/>
					</div>

					<div className="flex flex-wrap gap-3">
						<FormComponentInput<ShippingFormValuesType>
							labelText="Contact Name"
							id={elementIds.contact_name}
							fieldName="contact_name"
							fieldValue={formValues.contact_name ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-56"
							onChange={(e) =>
								handleChange('contact_name', e.target.value)
							}
							error={errors.contact_name}
						/>

						<FormComponentInput<ShippingFormValuesType>
							labelText="Contact Phone"
							id={elementIds.contact_phone}
							fieldName="contact_phone"
							fieldValue={formValues.contact_phone ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-48"
							onChange={(e) =>
								handleChange('contact_phone', e.target.value)
							}
							error={errors.contact_phone}
						/>

						<FormComponentInput<ShippingFormValuesType>
							labelText="Contact Email"
							id={elementIds.contact_email}
							fieldName="contact_email"
							fieldValue={formValues.contact_email ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-64"
							onChange={(e) =>
								handleChange('contact_email', e.target.value)
							}
							error={errors.contact_email}
						/>
					</div>

					<FormComponentTextarea<ShippingFormValuesType>
						labelText="Notes"
						id={elementIds.notes}
						fieldName="notes"
						fieldValue={formValues.notes ?? ''}
						isRequired={false}
						rows={3}
						disabled={pending}
						onChange={(e) => handleChange('notes', e.target.value)}
						error={errors.notes}
					/>
				</div>
			</TabsContent>

			{/*
			 * Force-mounted like every `TabsContent`, so the hidden `lines` field reaches `FormData`
			 * whether or not this panel is the one on screen.
			 */}
			<TabsContent id="lines">
				<div className="form-section">
					<p className="text-sm text-muted">
						What travels in this movement. Leave a variant at zero
						to send it in another one - a document can have several
						movements, each leaving from its own site.
					</p>

					{/*
					 * The whole list in one hidden field. Per-input names cannot express a list of
					 * objects, and the pipeline reads it back with `getFormDataAsJsonList`.
					 */}
					<input
						type="hidden"
						name="lines"
						value={JSON.stringify(lines)}
					/>

					<ShippingLinesEditor
						orderId={formValues.order_id}
						scope={scope}
						lines={lines}
						disabled={pending}
						error={ownErrorMessages(errors.lines)}
						onChange={(value) => handleChange('lines', value)}
					/>
				</div>
			</TabsContent>
		</Tabs>
	);
}
