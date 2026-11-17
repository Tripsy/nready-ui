'use client';

import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCalendar,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import {
	countErrorMessages,
	ownErrorMessages,
	rowErrorsAt,
	toOptionsFromEnum,
} from '@/helpers/form.helper';
import { requestFind } from '@/helpers/services.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	GRN_ITEMS_MAX,
	type GrnStatus,
	GrnStatusEnum,
} from '@/models/grn.model';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import { displayVendorLabel, type VendorModel } from '@/models/vendor.model';
import {
	displayWarehouseLabel,
	type WarehouseModel,
} from '@/models/warehouse.model';
import { useWindowForm } from '@/providers/window-form.provider';
import type { FindFunctionResponseType } from '@/types/action.type';
import { CurrencyEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'grn.field.warehouse',
	'grn.field.vendor',
	'grn.field.supplier_document_number',
	'grn.field.received_at',
	'grn.field.currency',
	'grn.field.exchange_rate',
	'grn.field.notes',
	'grn.field.variant',
	'grn.field.qty',
	'grn.field.unit_cost',
	'grn.field.vat_rate',
	'grn.field.lot_code',
	'grn.field.expires_at',
	'grn.section.details',
	'grn.section.items',
	'grn.text.add_line',
	'grn.text.label_remove_line',
	'grn.text.label_unit_cost_currency',
	'grn.text.placeholder_exchange_rate',
	'grn.text.placeholder_supplier_document_number',
	'grn.text.items_hint',
	'grn.text.locked_confirmed',
	'grn.text.no_items',
	'grn.text.remove',
	'dashboard.text.tab_errors',
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

/** The books are kept in one currency; a receipt in it needs no rate. */
const BASE_CURRENCY = Configuration.get('app.currency');

/** One line as the form holds it, before it is sent as part of the `items` payload. */
export type GrnItemFormType = {
	variant_id: number | null;
	qty: number | null;
	unit_cost: number | null;
	vat_rate: number | null;
	lot_code: string | null;
	expires_at: string | null;
	notes: string | null;
	// display-only fields, not part of validation
	/** What the picked variant is called, so a redrawn row still names what it holds. */
	label: string | null;
	/** This row's identity while it is being edited - see `nextGrnItemKey`. */
	key: string;
};

export type GrnFormValuesType = {
	warehouse_id: number | null;
	vendor_id: number | null;
	supplier_document_number: string | null;
	received_at: string | null;
	currency: string | null;
	exchange_rate: number | null;
	notes: string | null;
	items: GrnItemFormType[];
	// display-only fields, not part of validation
	/** The autocompletes' visible text. Submitted as `*_label` and never sent on. */
	warehouse: string | null;
	vendor: string | null;
	/**
	 * The status of the receipt being edited, null on a create. A confirmed receipt has moved
	 * stock: the backend then takes only the supplier document number and the notes, and refuses
	 * the request outright when anything else is sent - so the form locks the rest and the
	 * definition sends only those two.
	 */
	status: GrnStatus | null;
};

/*
 * A row's identity for React, since a line has no id until the receipt is saved and a half-filled
 * row has no variant yet. Not `crypto.randomUUID()`: that needs a secure context, and the dev host
 * is plain http. Uniqueness only has to hold within one form.
 */
let grnItemKeySequence = 0;

export function nextGrnItemKey(): string {
	grnItemKeySequence += 1;

	return `grn-item-${grnItemKeySequence}`;
}

export const emptyGrnItem = (): GrnItemFormType => ({
	variant_id: null,
	qty: null,
	unit_cost: null,
	vat_rate: Configuration.get('app.vatRate'),
	lot_code: null,
	expires_at: null,
	notes: null,
	label: null,
	key: nextGrnItemKey(),
});

const currencies = toOptionsFromEnum(CurrencyEnum);

/**
 * One received line. The picker lists stock-tracked variants only (`track_stock` filter) - the
 * backend refuses a line for an untracked one, since a lot nothing draws down is stock that never
 * leaves.
 */
function GrnItemRow({
	translations,
	item,
	index,
	currency,
	disabled,
	errors,
	onChange,
	onRemove,
}: {
	translations: TranslationsType;
	readonly item: GrnItemFormType;
	readonly index: number;
	readonly currency: string | null;
	readonly disabled: boolean;
	readonly errors: { [K in keyof GrnItemFormType]?: unknown } | undefined;
	readonly onChange: (patch: Partial<GrnItemFormType>) => void;
	readonly onRemove: () => void;
}) {
	const elementIds = useElementIds([
		`item-${index}-variant`,
		`item-${index}-qty`,
		`item-${index}-unit-cost`,
		`item-${index}-vat`,
		`item-${index}-lot-code`,
		`item-${index}-expires-at`,
	] as const);

	const [search, setSearch] = useState('');

	const { suggestions, isFetching } =
		useRemoteAutocomplete<ProductVariantModel>({
			query: search,
			queryKey: ['s-grn-variant', String(index)],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<ProductVariantModel>
					| undefined = await requestFind('product-variant', {
					filter: { term: term, track_stock: true },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	const toNumber = (value: string): number | null =>
		value === '' ? null : Number(value);

	return (
		<div className="rounded-lg border border-line p-3">
			<div className="flex gap-2">
				<div className="min-w-0 flex-1">
					<FormComponentAutoComplete<
						GrnItemFormType,
						ProductVariantModel
					>
						labelText={translations['grn.field.variant']}
						id={elementIds[`item-${index}-variant`]}
						fieldName="label"
						fieldValue={item.label ?? ''}
						isRequired={true}
						disabled={disabled}
						error={ownErrorMessages(errors?.variant_id)}
						onInputChange={(value) => {
							// Clearing the id with the text stops an edited label from keeping the
							// previously picked variant silently attached
							onChange({ label: value, variant_id: null });
							setSearch(value);
						}}
						autoCompleteProps={{
							suggestions: suggestions,
							isLoading: isFetching,
							onSelect: (variant) => {
								onChange({
									label: displayProductVariantLabel(variant),
									variant_id: variant.id,
									/*
									 * The variant's current average cost is the likeliest figure on
									 * the supplier's invoice - but only in the base currency, where
									 * it is stated. Never overwrites a cost already typed.
									 */
									unit_cost:
										item.unit_cost ??
										(currency === BASE_CURRENCY
											? variant.cost_price
											: null),
								});
							},
							getOptionLabel: (variant) =>
								displayProductVariantLabel(variant),
							getOptionKey: (variant) => variant.id,
						}}
					/>
				</div>

				<div className="flex shrink-0 flex-col gap-3">
					{/* The label the button does not have, so it lines up with the input */}
					<span
						aria-hidden="true"
						className="invisible text-sm font-semibold"
					>
						{translations['grn.text.remove']}
					</span>

					<Button
						type="button"
						variant="outline"
						hover="error"
						disabled={disabled}
						onClick={onRemove}
						aria-label={replaceVars(
							translations['grn.text.label_remove_line'],
							{ number: index + 1 },
						)}
						className="h-auto grow"
					>
						<Icons.Action.Delete className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-start gap-3">
				<FormComponentInput<GrnItemFormType>
					labelText={translations['grn.field.qty']}
					id={elementIds[`item-${index}-qty`]}
					fieldName="qty"
					fieldValue={item.qty ?? ''}
					isRequired={true}
					disabled={disabled}
					className="w-28"
					onChange={(e) =>
						onChange({ qty: toNumber(e.target.value) })
					}
					error={ownErrorMessages(errors?.qty)}
				/>

				<FormComponentInput<GrnItemFormType>
					labelText={
						currency
							? replaceVars(
									translations[
										'grn.text.label_unit_cost_currency'
									],
									{ currency },
								)
							: translations['grn.field.unit_cost']
					}
					id={elementIds[`item-${index}-unit-cost`]}
					fieldName="unit_cost"
					fieldValue={item.unit_cost ?? ''}
					isRequired={true}
					disabled={disabled}
					className="w-36"
					onChange={(e) =>
						onChange({ unit_cost: toNumber(e.target.value) })
					}
					error={ownErrorMessages(errors?.unit_cost)}
				/>

				<FormComponentInput<GrnItemFormType>
					labelText={translations['grn.field.vat_rate']}
					id={elementIds[`item-${index}-vat`]}
					fieldName="vat_rate"
					fieldValue={item.vat_rate ?? ''}
					isRequired={false}
					disabled={disabled}
					className="w-24"
					onChange={(e) =>
						onChange({ vat_rate: toNumber(e.target.value) })
					}
					error={ownErrorMessages(errors?.vat_rate)}
				/>

				<FormComponentInput<GrnItemFormType>
					labelText={translations['grn.field.lot_code']}
					id={elementIds[`item-${index}-lot-code`]}
					fieldName="lot_code"
					fieldValue={item.lot_code ?? ''}
					isRequired={false}
					disabled={disabled}
					className="w-40"
					onChange={(e) =>
						onChange({ lot_code: e.target.value || null })
					}
					error={ownErrorMessages(errors?.lot_code)}
				/>

				<FormComponentCalendar<GrnItemFormType>
					labelText={translations['grn.field.expires_at']}
					id={elementIds[`item-${index}-expires-at`]}
					fieldName="expires_at"
					fieldValue={item.expires_at ?? ''}
					isRequired={false}
					disabled={disabled}
					onSelect={(value) =>
						onChange({ expires_at: value || null })
					}
					error={ownErrorMessages(errors?.expires_at)}
				/>
			</div>
		</div>
	);
}

/** A confirmed receipt's lines, as they were received - nothing on them can change any more. */
function GrnItemsReadOnly({
	items,
	currency,
	translations,
}: {
	readonly items: GrnItemFormType[];
	readonly currency: string | null;
	translations: TranslationsType;
}) {
	if (items.length === 0) {
		return (
			<p className="text-sm text-muted">
				{translations['grn.text.no_items']}
			</p>
		);
	}

	return (
		<table className="w-full text-sm">
			<thead>
				<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
					<th className="py-2 pr-4 text-left font-medium">
						{translations['grn.field.variant']}
					</th>
					<th className="py-2 pr-4 text-right font-medium">
						{translations['grn.field.qty']}
					</th>
					<th className="py-2 text-right font-medium">
						{translations['grn.field.unit_cost']}
					</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-line">
				{items.map((item) => (
					<tr key={item.key}>
						<td className="py-2 pr-4">{item.label}</td>
						<td className="py-2 pr-4 text-right">{item.qty}</td>
						<td className="py-2 text-right">
							{item.unit_cost} {currency}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

const FORM_TABS = [
	{ id: 'details', labelKey: 'grn.section.details' },
	{ id: 'items', labelKey: 'grn.section.items' },
] as const;

type FormTabId = (typeof FORM_TABS)[number]['id'];

/** Which tab owns which field, for the error badge on the tab strip. */
const TAB_FIELDS: Record<FormTabId, readonly (keyof GrnFormValuesType)[]> = {
	details: [
		'warehouse_id',
		'vendor_id',
		'supplier_document_number',
		'received_at',
		'currency',
		'exchange_rate',
		'notes',
	],
	items: ['items'],
};

export function FormManageGrn() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<GrnFormValuesType>();

	const elementIds = useElementIds([
		'warehouse',
		'vendor',
		'supplier_document_number',
		'received_at',
		'currency',
		'exchange_rate',
		'notes',
	] as const);

	const [tab, setTab] = useState<FormTabId>('details');
	const [searchWarehouse, setSearchWarehouse] = useState('');
	const [searchVendor, setSearchVendor] = useState('');

	// Anything but a draft has moved stock; see `GrnFormValuesType.status`
	const isLocked =
		formValues.status !== null && formValues.status !== GrnStatusEnum.DRAFT;

	const items = formValues.items ?? [];
	const itemErrors = errors.items;
	const isForeignCurrency =
		!!formValues.currency && formValues.currency !== BASE_CURRENCY;

	const {
		suggestions: warehouseSuggestions,
		isFetching: isWarehouseFetching,
	} = useRemoteAutocomplete<WarehouseModel>({
		query: searchWarehouse,
		queryKey: ['s-grn-warehouse'],
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

	// Goods come from suppliers; a services provider has nothing to deliver to a warehouse
	const { suggestions: vendorSuggestions, isFetching: isVendorFetching } =
		useRemoteAutocomplete<VendorModel>({
			query: searchVendor,
			queryKey: ['s-grn-vendor'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<VendorModel>
					| undefined = await requestFind('vendor', {
					filter: { term: term, type: 'supplier' },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

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

	const updateItem = (index: number, patch: Partial<GrnItemFormType>) =>
		handleChange(
			'items',
			items.map((item, position) =>
				position === index ? { ...item, ...patch } : item,
			),
		);

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
					<input
						type="hidden"
						name="status"
						value={formValues.status ?? ''}
					/>

					{isLocked && (
						<>
							<p className="text-sm text-muted">
								{translations['grn.text.locked_confirmed']}
							</p>
							{/*
							 * A disabled control is left out of the submitted form data, so a redraw
							 * after a refused submit would blank it. These carry the values instead -
							 * never sent on, since a confirmed receipt sends only the two editable
							 * fields.
							 */}
							<input
								type="hidden"
								name="received_at"
								value={formValues.received_at ?? ''}
							/>
							<input
								type="hidden"
								name="currency"
								value={formValues.currency ?? ''}
							/>
						</>
					)}

					<input
						type="hidden"
						name="warehouse_id"
						value={formValues.warehouse_id ?? ''}
					/>
					<input
						type="hidden"
						name="warehouse_label"
						value={formValues.warehouse ?? ''}
					/>
					<FormComponentAutoComplete<
						GrnFormValuesType,
						WarehouseModel
					>
						labelText={translations['grn.field.warehouse']}
						id={elementIds.warehouse}
						fieldName="warehouse"
						fieldValue={formValues.warehouse ?? ''}
						className="pl-8"
						isRequired={true}
						disabled={pending || isLocked}
						error={errors.warehouse_id}
						onInputChange={(value) => {
							handleChange('warehouse', value);
							handleChange('warehouse_id', null);
							setSearchWarehouse(value);
						}}
						autoCompleteProps={{
							suggestions: warehouseSuggestions,
							isLoading: isWarehouseFetching,
							onSelect: (warehouse) => {
								handleChange(
									'warehouse',
									displayWarehouseLabel(warehouse),
								);
								handleChange('warehouse_id', warehouse.id);
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
						name="vendor_id"
						value={formValues.vendor_id ?? ''}
					/>
					<input
						type="hidden"
						name="vendor_label"
						value={formValues.vendor ?? ''}
					/>
					<FormComponentAutoComplete<GrnFormValuesType, VendorModel>
						labelText={translations['grn.field.vendor']}
						id={elementIds.vendor}
						fieldName="vendor"
						fieldValue={formValues.vendor ?? ''}
						className="pl-8"
						isRequired={true}
						disabled={pending || isLocked}
						error={errors.vendor_id}
						onInputChange={(value) => {
							handleChange('vendor', value);
							handleChange('vendor_id', null);
							setSearchVendor(value);
						}}
						autoCompleteProps={{
							suggestions: vendorSuggestions,
							isLoading: isVendorFetching,
							onSelect: (vendor) => {
								handleChange(
									'vendor',
									displayVendorLabel(vendor),
								);
								handleChange('vendor_id', vendor.id);
							},
							getOptionLabel: (vendor) =>
								displayVendorLabel(vendor),
							getOptionKey: (vendor) => vendor.id,
						}}
						icons={{
							left: (
								<Icons.Vendor className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>

					<FormComponentInput<GrnFormValuesType>
						labelText={
							translations['grn.field.supplier_document_number']
						}
						id={elementIds.supplier_document_number}
						fieldName="supplier_document_number"
						fieldValue={formValues.supplier_document_number ?? ''}
						isRequired={false}
						disabled={pending}
						placeholderText={
							translations[
								'grn.text.placeholder_supplier_document_number'
							]
						}
						onChange={(e) =>
							handleChange(
								'supplier_document_number',
								e.target.value,
							)
						}
						error={errors.supplier_document_number}
					/>

					<div className="flex flex-wrap gap-4">
						<FormComponentCalendar<GrnFormValuesType>
							labelText={translations['grn.field.received_at']}
							id={elementIds.received_at}
							fieldName="received_at"
							fieldValue={formValues.received_at ?? ''}
							isRequired={true}
							disabled={pending || isLocked}
							onSelect={(value) =>
								handleChange('received_at', value)
							}
							error={errors.received_at}
						/>

						<FormComponentSelect<GrnFormValuesType>
							labelText={translations['grn.field.currency']}
							id={elementIds.currency}
							fieldName="currency"
							fieldValue={formValues.currency ?? ''}
							isRequired={true}
							disabled={pending || isLocked}
							className="w-32"
							options={currencies}
							onChange={(value) => {
								handleChange('currency', value);
								// A rate belongs to one currency - another starts unresolved
								handleChange('exchange_rate', null);
							}}
							error={errors.currency}
						/>

						{isForeignCurrency && (
							<FormComponentInput<GrnFormValuesType>
								labelText={
									translations['grn.field.exchange_rate']
								}
								id={elementIds.exchange_rate}
								fieldName="exchange_rate"
								fieldValue={formValues.exchange_rate ?? ''}
								isRequired={false}
								disabled={pending || isLocked}
								className="w-48"
								placeholderText={
									translations[
										'grn.text.placeholder_exchange_rate'
									]
								}
								onChange={(e) =>
									handleChange(
										'exchange_rate',
										e.target.value === ''
											? null
											: Number(e.target.value),
									)
								}
								error={errors.exchange_rate}
							/>
						)}
					</div>

					<FormComponentTextarea<GrnFormValuesType>
						labelText={translations['grn.field.notes']}
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

			<TabsContent id="items">
				<div className="form-section">
					{/*
					 * The whole list in one hidden field. Per-input names cannot express a list of
					 * objects, and the pipeline reads it back with `getFormDataAsJsonList`.
					 */}
					<input
						type="hidden"
						name="items"
						value={JSON.stringify(items)}
					/>

					{ownErrorMessages(itemErrors)?.map((message) => (
						<p key={message} className="text-sm text-danger">
							{message}
						</p>
					))}

					{isLocked ? (
						<GrnItemsReadOnly
							items={items}
							currency={formValues.currency}
							translations={translations}
						/>
					) : (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-muted">
								{translations['grn.text.items_hint']}
							</p>

							{items.map((item, index) => (
								<GrnItemRow
									translations={translations}
									key={item.key}
									item={item}
									index={index}
									currency={formValues.currency}
									disabled={pending}
									errors={rowErrorsAt<GrnItemFormType>(
										itemErrors,
										index,
									)}
									onChange={(patch) =>
										updateItem(index, patch)
									}
									onRemove={() =>
										handleChange(
											'items',
											items.filter(
												(_, position) =>
													position !== index,
											),
										)
									}
								/>
							))}

							<Button
								type="button"
								variant="outline"
								className="self-start"
								disabled={
									pending || items.length >= GRN_ITEMS_MAX
								}
								onClick={() =>
									handleChange('items', [
										...items,
										emptyGrnItem(),
									])
								}
							>
								<Icons.Action.Add className="h-4 w-4" />
								{translations['grn.text.add_line']}
							</Button>
						</div>
					)}
				</div>
			</TabsContent>
		</Tabs>
	);
}
