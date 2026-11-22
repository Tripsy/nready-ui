'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CarrierModel } from '@/models/carrier.model';
import type { ClientAddressModel } from '@/models/client-address.model';
import {
	displayOrderReference,
	type OrderLineModel,
	type OrderModel,
} from '@/models/order.model';
import {
	SHIPPING_SCOPE_SHAPE,
	type ShippingLineCondition,
	ShippingLineConditionEnum,
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
import type { EntityId } from '@/types/entity-id.type';

const TRANSLATION_KEYS = [
	'shipping.field.carrier',
	'shipping.field.contact_email',
	'shipping.field.contact_name',
	'shipping.field.contact_phone',
	'shipping.field.currency',
	'shipping.field.document_ref',
	'shipping.field.estimated_delivery_at',
	'shipping.field.method',
	'shipping.field.notes',
	'shipping.field.order',
	'shipping.field.price',
	'shipping.field.quantity',
	'shipping.field.condition',
	'shipping.text.condition_hint',
	'shipping.field.scope',
	'shipping.field.tracking_number',
	'shipping.field.tracking_url',
	'shipping.field.vat_rate',
	'shipping.text.relocation_lines_hint',
	'shipping.text.label_operational_cost',
	'shipping.text.loading_order_lines',
	'shipping.text.pick_order_first',
	'shipping.text.placeholder_document_ref',
	'shipping.text.order_no_lines',
	'shipping.text.lines_hint',
	'shipping.text.variant_ref',
	'shipping.text.ordered_quantity',
	'shipping.text.line_part',
	'shipping.text.line_no_options',
	'shipping.text.line_in_bundle',
	'shipping.section.details',
	'shipping.section.lines',
	'dashboard.text.tab_errors',
	'shipping.field.pickup_warehouse',
	'shipping.field.destination_warehouse',
	'shipping.field.pickup_address',
	'shipping.field.destination_address',
	'shipping.text.scope_fixed',
	'shipping.text.placeholder_excl_vat',
	'shipping.text.placeholder_from_rates',
	'shipping.text.placeholder_not_recorded',
	'shipping.text.placeholder_estimate',
	...enumTranslationKeys('shipping.enum.method', ShippingMethodEnum),
	...enumTranslationKeys('shipping.enum.scope', ShippingScopeEnum),
	...enumTranslationKeys(
		'shipping.enum.condition',
		ShippingLineConditionEnum,
	),
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

/** The books are kept in one currency, which is what `operational_cost` is entered in. */
const BASE_CURRENCY = Configuration.get('app.currency');

/** One line as the form holds it, before it is sent as part of the `lines` payload. */
export type ShippingLineFormType = {
	variant_id: EntityId;
	product_id: EntityId;
	quantity: number | null;
	/** A `return` line's only - what the warehouse found the goods fit for. */
	condition: ShippingLineCondition | null;
	notes: string | null;
};

export type ShippingFormValuesType = {
	scope: string | null;
	order_id: EntityId | null;
	document_ref: EntityId | null;
	pickup_warehouse_id: EntityId | null;
	pickup_client_address_id: EntityId | null;
	destination_warehouse_id: EntityId | null;
	destination_client_address_id: EntityId | null;
	carrier_id: EntityId | null;
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

/**
 * What travels, by variant.
 *
 * With an order behind the movement the variants come from the order itself, so an operator picks
 * quantities rather than typing ids - the same screen that splits an order across two warehouses.
 * A `relocation` has no order, and choosing arbitrary stock to move needs the relocation document
 * that does not exist yet, so the editor says so rather than offering a picker that cannot be
 * validated.
 *
 * **One row per variant**, as a movement's lines are (unique per variant on the backend). A variant
 * the order holds on several lines - a bundle component and a standalone line of the same shirt -
 * is one row, its ordered quantity summed across them. Beneath it, read-only, the order lines it
 * covers - quantity, options, the bundle a component came in - since the movement records the
 * variant alone and the operator packing it still has to know which configuration goes in.
 *
 * A row left at zero is simply not carried. The backend owns the real rule: a quantity above what
 * the order still has unshipped for that variant comes back as a 409, because what another movement
 * already claimed is not knowable from this form alone. For a `return` the cap is what was
 * delivered and is not already coming back, checked the same way.
 *
 * **A `return` line also takes its condition** once the goods are looked at. The return cannot be
 * received until every line has one: resellable goods go back into stock, damaged ones are written
 * off. The quantity can be corrected at the same time, to what actually arrived.
 */
function ShippingLinesEditor({
	translations,
	orderId,
	scope,
	lines,
	disabled,
	error,
	onChange,
}: {
	translations: TranslationsType;
	readonly orderId: EntityId | null;
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

	const conditions = useMemo(
		() =>
			toOptionsFromEnum(ShippingLineConditionEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'shipping.enum.condition',
						value,
					),
			}),
		[translations],
	);

	const variantRows = useMemo(() => {
		const rows = new Map<
			EntityId,
			{
				variant_id: EntityId;
				product_id: EntityId;
				label: string | null;
				quantity: number;
				parts: {
					key: string;
					quantity: number;
					description: string;
					/** No options and no bundle - a line that adds nothing to the row */
					is_plain: boolean;
				}[];
			}
		>();

		const lineById = new Map(
			(orderLines ?? []).map((orderLine) => [orderLine.id, orderLine]),
		);

		for (const orderLine of orderLines ?? []) {
			const options = (orderLine.options ?? [])
				.map((option) => option.label)
				.join(', ');
			const bundle = orderLine.parent_id
				? lineById.get(orderLine.parent_id)?.label
				: null;

			const description = [
				options || translations['shipping.text.line_no_options'],
				bundle
					? replaceVars(
							translations['shipping.text.line_in_bundle'],
							{
								bundle: bundle,
							},
						)
					: null,
			]
				.filter(Boolean)
				.join(' · ');

			const part = {
				key: orderLine.id,
				quantity: Number(orderLine.quantity),
				description: description,
				is_plain: !options && !bundle,
			};

			const row = rows.get(orderLine.variant_id);

			if (row) {
				// Quantities are `numeric(12,2)`; keep the sum at that scale
				row.quantity =
					Math.round((row.quantity + part.quantity) * 100) / 100;
				row.label = row.label ?? orderLine.label ?? null;
				row.parts.push(part);
			} else {
				rows.set(orderLine.variant_id, {
					variant_id: orderLine.variant_id,
					product_id: orderLine.product_id,
					label: orderLine.label ?? null,
					quantity: part.quantity,
					parts: [part],
				});
			}
		}

		return [...rows.values()];
	}, [orderLines, translations]);

	if (scope === ShippingScopeEnum.RELOCATION) {
		return (
			<p className="text-sm text-muted">
				{translations['shipping.text.relocation_lines_hint']}
			</p>
		);
	}

	if (!orderId) {
		return (
			<p className="text-sm text-muted">
				{translations['shipping.text.pick_order_first']}
			</p>
		);
	}

	if (isLoading) {
		return (
			<p className="text-sm text-muted">
				{translations['shipping.text.loading_order_lines']}
			</p>
		);
	}

	if (variantRows.length === 0) {
		return (
			<p className="text-sm text-muted">
				{translations['shipping.text.order_no_lines']}
			</p>
		);
	}

	const isReturn = scope === ShippingScopeEnum.RETURN;

	const lineFor = (variantId: EntityId): ShippingLineFormType | undefined =>
		lines.find((line) => line.variant_id === variantId);

	const quantityFor = (variantId: EntityId): number | null =>
		lineFor(variantId)?.quantity ?? null;

	const setCondition = (variantId: EntityId, value: string) => {
		onChange(
			lines.map((line) =>
				line.variant_id === variantId
					? {
							...line,
							condition: (value ||
								null) as ShippingLineCondition | null,
						}
					: line,
			),
		);
	};

	const setQuantity = (
		variantId: EntityId,
		productId: EntityId,
		value: string,
	) => {
		const quantity = value === '' ? null : Number(value);

		const without = lines.filter((line) => line.variant_id !== variantId);

		if (quantity === null || quantity <= 0) {
			onChange(without);

			return;
		}

		const current = lineFor(variantId);

		onChange([
			...without,
			{
				variant_id: variantId,
				product_id: productId,
				quantity: quantity,
				condition: current?.condition ?? null,
				notes: current?.notes ?? null,
			},
		]);
	};

	return (
		<div className="flex flex-col gap-3">
			{variantRows.map((row) => (
				<div
					key={row.variant_id}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
				>
					<div className="min-w-0 flex-1">
						<div className="font-medium">
							{row.label ??
								replaceVars(
									translations['shipping.text.variant_ref'],
									{
										id: row.variant_id,
									},
								)}
						</div>
						<div className="text-xs text-muted">
							{replaceVars(
								translations['shipping.text.ordered_quantity'],
								{
									quantity: row.quantity,
								},
							)}
						</div>

						{/* A single plain line says nothing the row does not */}
						{(row.parts.length > 1 || !row.parts[0].is_plain) && (
							<ul className="mt-1 text-xs text-muted">
								{row.parts.map((part) => (
									<li key={part.key}>
										{replaceVars(
											translations[
												'shipping.text.line_part'
											],
											{
												quantity: part.quantity,
												description: part.description,
											},
										)}
									</li>
								))}
							</ul>
						)}
					</div>

					<FormComponentInput<ShippingLineFormType>
						labelText={translations['shipping.field.quantity']}
						id={`shipping-line-${row.variant_id}`}
						fieldName="quantity"
						fieldValue={quantityFor(row.variant_id) ?? ''}
						isRequired={false}
						disabled={disabled}
						className="w-32"
						placeholderText="0"
						onChange={(e) =>
							setQuantity(
								row.variant_id,
								row.product_id,
								e.target.value,
							)
						}
					/>

					{isReturn && (
						<FormComponentSelect<ShippingLineFormType>
							labelText={translations['shipping.field.condition']}
							id={`shipping-line-condition-${row.variant_id}`}
							fieldName="condition"
							fieldValue={
								lineFor(row.variant_id)?.condition ?? ''
							}
							isRequired={false}
							disabled={disabled || !lineFor(row.variant_id)}
							className="w-44"
							options={conditions}
							onChange={(value) =>
								setCondition(row.variant_id, value)
							}
						/>
					)}
				</div>
			))}

			{isReturn && (
				<p className="text-xs text-muted">
					{translations['shipping.text.condition_hint']}
				</p>
			)}

			{error?.map((message) => (
				<p key={message} className="text-sm text-danger">
					{message}
				</p>
			))}
		</div>
	);
}

const FORM_TABS = [
	{ id: 'details', labelKey: 'shipping.section.details' },
	{ id: 'lines', labelKey: 'shipping.section.lines' },
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
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const scopes = useMemo(
		() =>
			toOptionsFromEnum(ShippingScopeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'shipping.enum.scope',
						value,
					),
			}),
		[translations],
	);

	const methods = useMemo(
		() =>
			toOptionsFromEnum(ShippingMethodEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'shipping.enum.method',
						value,
					),
			}),
		[translations],
	);

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

	// The sentence wraps the movement type in a styled span, so it is split on the slot
	const [scopeFixedBefore, scopeFixedAfter = ''] = (
		translations['shipping.text.scope_fixed'] ?? ''
	).split('{{type}}');

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
							? translations['shipping.field.pickup_warehouse']
							: translations[
									'shipping.field.destination_warehouse'
								]
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
							? translations['shipping.field.pickup_address']
							: translations['shipping.field.destination_address']
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
				{FORM_TABS.map(({ id, labelKey }) => (
					<TabsTrigger key={id} id={id}>
						{translations[labelKey]}
						{tabErrors[id] > 0 && (
							<span className="ml-1.5 rounded-full bg-danger px-1.5 text-xs text-white">
								{tabErrors[id]}
								<span className="sr-only">
									{' '}
									{translations['dashboard.text.tab_errors']}
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
								{scopeFixedBefore}
								<span className="font-medium">
									{translateEnumLabel(
										translations,
										'shipping.enum.scope',
										formValues.scope ?? '',
									)}
								</span>
								{scopeFixedAfter}
							</p>
						</>
					) : (
						<FormComponentSelect<ShippingFormValuesType>
							labelText={translations['shipping.field.scope']}
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
								labelText={translations['shipping.field.order']}
								id={elementIds.order}
								fieldName="order"
								fieldValue={formValues.order ?? ''}
								className="pl-8"
								isRequired={true}
								/*
								 * Fixed once the movement exists: the backend does not take
								 * `order_id` on an update, and its lines are allocated against
								 * this order's - moving it would be a different movement.
								 */
								disabled={pending || formValues.is_existing}
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
							labelText={
								translations['shipping.field.document_ref']
							}
							id={elementIds.document_ref}
							fieldName="document_ref"
							fieldValue={formValues.document_ref ?? ''}
							isRequired={true}
							disabled={pending}
							className="w-56"
							placeholderText={
								translations[
									'shipping.text.placeholder_document_ref'
								]
							}
							onChange={(e) =>
								handleChange('document_ref', e.target.value)
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
							labelText={translations['shipping.field.method']}
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
							labelText={
								translations[
									'shipping.field.estimated_delivery_at'
								]
							}
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
						labelText={translations['shipping.field.carrier']}
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
							labelText={
								translations['shipping.field.tracking_number']
							}
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
							labelText={
								translations['shipping.field.tracking_url']
							}
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
							labelText={translations['shipping.field.price']}
							id={elementIds.price}
							fieldType="number"
							fieldName="price"
							fieldValue={formValues.price ?? ''}
							isRequired={formValues.is_existing}
							disabled={pending}
							className="w-36"
							placeholderText={
								formValues.is_existing
									? translations[
											'shipping.text.placeholder_excl_vat'
										]
									: translations[
											'shipping.text.placeholder_from_rates'
										]
							}
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

						<FormComponentInput<ShippingFormValuesType>
							labelText={translations['shipping.field.vat_rate']}
							id={elementIds.vat_rate}
							fieldType="number"
							fieldName="vat_rate"
							fieldValue={formValues.vat_rate ?? ''}
							isRequired={formValues.is_existing}
							disabled={pending}
							className="w-28"
							placeholderText={
								formValues.is_existing
									? undefined
									: translations[
											'shipping.text.placeholder_from_rates'
										]
							}
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

						<FormComponentSelect<ShippingFormValuesType>
							labelText={translations['shipping.field.currency']}
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
							labelText={replaceVars(
								translations[
									'shipping.text.label_operational_cost'
								],
								{ currency: BASE_CURRENCY },
							)}
							id={elementIds.operational_cost}
							fieldType="number"
							fieldName="operational_cost"
							fieldValue={formValues.operational_cost ?? ''}
							isRequired={false}
							disabled={pending}
							className="w-44"
							placeholderText={
								formValues.is_existing
									? translations[
											'shipping.text.placeholder_not_recorded'
										]
									: translations[
											'shipping.text.placeholder_estimate'
										]
							}
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
							labelText={
								translations['shipping.field.contact_name']
							}
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
							labelText={
								translations['shipping.field.contact_phone']
							}
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
							labelText={
								translations['shipping.field.contact_email']
							}
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
						labelText={translations['shipping.field.notes']}
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
						{translations['shipping.text.lines_hint']}
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
						translations={translations}
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
