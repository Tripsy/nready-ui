import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { getLanguageClient } from '@/config/translate.setup';
import {
	countErrorMessages,
	ownErrorMessages,
	rowErrorsAt,
	toOptionsFromEnum,
} from '@/helpers/form.helper';
import { requestFind, requestView } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import { hasPermission } from '@/models/account.model';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import { type DiscountType, DiscountTypeEnum } from '@/models/discount.model';
import {
	displayOrderMoney,
	ORDER_LINES_MAX,
	type OrderStatus,
	OrderStatusEnum,
} from '@/models/order.model';
import {
	displayOptionLabel,
	type ProductModel,
	type ProductOptionGroupType,
} from '@/models/product.model';
import {
	displayProductVariantLabel,
	type ProductVariantModel,
} from '@/models/product-variant.model';
import { useAuth } from '@/providers/auth.provider';
import { useWindowForm } from '@/providers/window-form.provider';
import { findVariantsByIds } from '@/services/product.service';
import type { FindFunctionResponseType } from '@/types/action.type';
import { CurrencyEnum } from '@/types/common.type';

/** One line as the form holds it, before it is sent as part of the `lines` payload. */
export type OrderLineFormType = {
	variant_id: number | null;
	product_id: number | null;
	quantity: number | null;
	price: number | null;
	vat_rate: number | null;
	/** The `product_option` ids chosen on the line; the backend turns them into snapshots. */
	options: number[];
	/**
	 * A discount the operator typed for this line, in the order's currency - an `amount` is per
	 * unit. Replaces the catalog's rule for the line; null leaves the catalog to decide.
	 */
	discount_type: DiscountType | null;
	discount_value: number | null;
	notes: string | null;
	// display-only fields, not part of validation
	/** What the picked variant is called, so a redrawn row still names what it holds. */
	label: string | null;
	/**
	 * What the discounts took off this line when the order was raised, and what they were called.
	 * Read-only in both directions: even a typed discount is clamped by the backend against the
	 * market's floor, and a line set being edited has not been through that pass yet - so on the
	 * editor these are null until the document is saved and re-read.
	 */
	discount_reduction: number | null;
	discount_label: string | null;
	/** This row's identity while it is being edited - see `nextOrderLineKey`. */
	key: string;
};

/*
 * A row's identity for React, since a line has no id until the document is saved and two rows may
 * legitimately name the same variant while one is still being filled in. Not `crypto.randomUUID()`:
 * that needs a secure context, and the dev host is plain http, so it would throw where it is most
 * convenient to test. Uniqueness only has to hold within one form.
 */
let orderLineKeySequence = 0;

export function nextOrderLineKey(): string {
	orderLineKeySequence += 1;

	return `order-line-${orderLineKeySequence}`;
}

export type OrderFormValuesType = {
	client_id: number | null;
	currency: string | null;
	notes: string | null;
	lines: OrderLineFormType[];
	/**
	 * An order-wide discount the operator typed, apportioned over the lines in place of the
	 * catalog's campaign. Its terms are `order.discount`, but the money sits in the lines, so the
	 * backend accepts it only together with the line set - which this form always sends.
	 */
	discount_type: DiscountType | null;
	discount_value: number | null;
	// display-only fields, not part of validation
	/** The autocomplete's visible text. Submitted as `client_label` and never sent on. */
	client: string | null;
	/**
	 * The status of the order being edited, absent on a create.
	 *
	 * Carried so the editor can lock itself: the backend accepts a new line set only while the
	 * order is pending, and a form that let an operator rearrange a confirmed order's lines would
	 * be collecting work it knows will be refused.
	 */
	status: OrderStatus | null;
};

export const emptyOrderLine = (): OrderLineFormType => ({
	variant_id: null,
	product_id: null,
	quantity: 1,
	price: null,
	vat_rate: Configuration.get('app.vatRate'),
	options: [],
	discount_type: null,
	discount_value: null,
	notes: null,
	label: null,
	discount_reduction: null,
	discount_label: null,
	key: nextOrderLineKey(),
});

const currencies = toOptionsFromEnum(CurrencyEnum);

/**
 * The discount picker's choices. `none` stands for null because a list item cannot be keyed by
 * an empty string; `toDiscountType` maps it back.
 */
const DISCOUNT_TYPE_NONE = 'none';

function discountTypeOptions(currency: string | null) {
	return [
		{ label: 'Catalog rules', value: DISCOUNT_TYPE_NONE },
		{ label: 'Percent (%)', value: DiscountTypeEnum.PERCENT },
		{
			label: `Amount${currency ? ` (${currency})` : ''}`,
			value: DiscountTypeEnum.AMOUNT,
		},
	];
}

function toDiscountType(value: string): DiscountType | null {
	return value === DiscountTypeEnum.PERCENT ||
		value === DiscountTypeEnum.AMOUNT
		? value
		: null;
}

/**
 * Why a line's typed discount will take off less than it says, or null when it applies in full.
 *
 * Mirrors the backend's `computeReduction`: per unit, a discount stops at the market's
 * `min_price`, and a line with no floor in this currency stops only at zero. A preview, not the
 * verdict - the backend clamps again on save, against the floor as it stands then.
 */
function describeDiscountClamp(
	line: OrderLineFormType,
	minPrice: number | null,
	currency: string | null,
): string | null {
	if (!line.discount_type || !line.discount_value || line.price === null) {
		return null;
	}

	const wanted =
		line.discount_type === DiscountTypeEnum.PERCENT
			? (line.price * line.discount_value) / 100
			: line.discount_value;

	const allowed =
		minPrice === null ? line.price : Math.max(0, line.price - minPrice);

	if (wanted <= allowed) {
		return null;
	}

	const money = (value: number) => displayOrderMoney(value, currency ?? '');

	if (allowed <= 0) {
		return minPrice === null
			? 'The unit price is zero, so this discount takes nothing off.'
			: `The unit price is at or below this market's minimum of ${money(minPrice)}, so this discount takes nothing off.`;
	}

	return `Capped at ${money(allowed)} per unit - this market's minimum price is ${money(minPrice ?? 0)}.`;
}

/** An emptied number field is no figure at all, not zero. */
function toNullableNumber(value: string): number | null {
	return value.trim() === '' ? null : Number(value);
}

/**
 * The catalog price for a variant in the order's currency, when the listing carried one.
 *
 * A suggestion, not a rule: the operator agrees the figure, and this only saves them reading it
 * off the product page. A variant with no price row in this currency leaves the field empty
 * rather than filling in another market's number.
 */
function suggestPrice(
	variant: ProductVariantModel,
	currency: string | null,
): number | null {
	const price = variant.prices?.find((entry) => entry.currency === currency);

	return price ? Number(price.sale_price) : null;
}

/**
 * What a placed order was agreed on, for reading rather than editing.
 *
 * The form already holds these - it re-reads the document to fill the editor a pending order gets - so
 * showing them costs nothing and saves closing the form to look them up in the details window.
 *
 * **No total.** Each row states what it was quoted at and what the catalog took off it, but the
 * document's sums - and the VAT they carry - live in the details window rather than being added up
 * a second time here.
 */
function OrderLinesReadOnly({
	lines,
	currency,
}: {
	readonly lines: OrderLineFormType[];
	readonly currency: string | null;
}) {
	if (lines.length === 0) {
		return <p className="text-sm text-muted">This order has no lines.</p>;
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
						<th className="py-2 pr-4 text-left font-medium">
							Item
						</th>
						<th className="py-2 pr-4 text-right font-medium">
							Qty
						</th>
						<th className="py-2 pr-4 text-right font-medium">
							Unit
						</th>
						<th className="py-2 pr-4 text-right font-medium">
							VAT
						</th>
						<th className="py-2 pr-4 text-right font-medium">
							Discount
						</th>
						<th className="py-2 text-right font-medium">Net</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-line">
					{lines.map((line) => (
						<tr key={line.key}>
							<td className="py-2 pr-4 align-top">
								<div className="font-medium">
									{line.label ??
										`Variant #${line.variant_id}`}
								</div>
								{line.notes && (
									<div className="mt-1 text-xs italic text-muted">
										“{line.notes}”
									</div>
								)}
							</td>
							<td className="py-2 pr-4 text-right align-top">
								{line.quantity ?? '-'}
							</td>
							<td className="py-2 pr-4 text-right align-top">
								{line.price === null
									? '-'
									: displayOrderMoney(
											line.price,
											currency ?? '',
										)}
							</td>
							<td className="py-2 pr-4 text-right align-top">
								{line.vat_rate === null
									? '-'
									: `${line.vat_rate}%`}
							</td>
							<td className="py-2 pr-4 text-right align-top">
								{line.discount_reduction ? (
									<>
										<div>
											-
											{displayOrderMoney(
												line.discount_reduction,
												currency ?? '',
											)}
										</div>
										{line.discount_label && (
											<div className="text-xs text-muted">
												{line.discount_label}
											</div>
										)}
									</>
								) : (
									'-'
								)}
							</td>
							<td className="py-2 text-right align-top font-medium">
								{line.price === null || line.quantity === null
									? '-'
									: displayOrderMoney(
											line.price * line.quantity -
												(line.discount_reduction ?? 0),
											currency ?? '',
										)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function OrderLineRow({
	line,
	index,
	currency,
	disabled,
	canDiscount,
	minPrice,
	errors,
	onChange,
	onRemove,
}: {
	readonly line: OrderLineFormType;
	readonly index: number;
	readonly currency: string | null;
	readonly disabled: boolean;
	/** Without `order.discount` the fields still show what was typed, but cannot change it. */
	readonly canDiscount: boolean;
	/**
	 * The variant's `min_price` in the order's currency, null when the market states none.
	 * Undefined while it loads, which shows no warning rather than a premature one.
	 */
	readonly minPrice: number | null | undefined;
	readonly errors: { [K in keyof OrderLineFormType]?: unknown } | undefined;
	readonly onChange: (patch: Partial<OrderLineFormType>) => void;
	readonly onRemove: () => void;
}) {
	const elementIds = useElementIds([
		`line-${index}-variant`,
		`line-${index}-quantity`,
		`line-${index}-price`,
		`line-${index}-vat`,
		`line-${index}-discount-type`,
		`line-${index}-discount-value`,
		`line-${index}-notes`,
	] as const);

	const clampWarning =
		minPrice === undefined
			? null
			: describeDiscountClamp(line, minPrice, currency);

	const [search, setSearch] = useState('');

	const { suggestions, isFetching } =
		useRemoteAutocomplete<ProductVariantModel>({
			query: search,
			queryKey: ['s-order-variant', String(index)],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<ProductVariantModel>
					| undefined = await requestFind('product-variant', {
					filter: { term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	return (
		<div className="rounded-lg border border-line p-3">
			{/*
			 * Stretched rather than aligned to a height of its own: the field is `text-base` and
			 * drops to `md:text-sm`, so the input is 42px on a narrow window and 38px above `md`,
			 * and a button pinned to either number is wrong at the other. The column beside it
			 * repeats the field's own shape - a label's worth of height, the same `gap-3`, then
			 * the control - so the button ends up exactly as tall as the input it sits next to.
			 * The field's error is an absolutely positioned tooltip and adds no height, so the row
			 * does not shift when the variant fails validation.
			 */}
			<div className="flex gap-2">
				<div className="min-w-0 flex-1">
					<FormComponentAutoComplete<
						OrderLineFormType,
						ProductVariantModel
					>
						labelText="Variant"
						id={elementIds[`line-${index}-variant`]}
						fieldName="label"
						fieldValue={line.label ?? ''}
						isRequired={true}
						disabled={disabled}
						error={ownErrorMessages(errors?.variant_id)}
						onInputChange={(value) => {
							/*
							 * Clearing the ids with the text stops an edited label from
							 * keeping the previously picked variant silently attached - and
							 * `product_id` travels with `variant_id` because the backend row
							 * holds both under one composite key.
							 */
							onChange({
								label: value,
								variant_id: null,
								product_id: null,
								options: [],
							});
							setSearch(value);
						}}
						autoCompleteProps={{
							suggestions: suggestions,
							isLoading: isFetching,
							onSelect: (variant) => {
								onChange({
									label: displayProductVariantLabel(variant),
									variant_id: variant.id,
									product_id: variant.product_id,
									// Answers belong to a product's questions; another product asks others
									...(variant.product_id !== line.product_id
										? { options: [] }
										: {}),
									price:
										line.price ??
										suggestPrice(variant, currency),
								});
							},
							getOptionLabel: (variant) =>
								displayProductVariantLabel(variant),
							getOptionKey: (variant) => variant.id,
						}}
					/>
				</div>

				<div className="flex shrink-0 flex-col gap-3">
					{/*
					 * The label the button does not have. Rendered rather than measured as a
					 * margin, so it tracks whatever the label rule says a label is worth.
					 */}
					<span
						aria-hidden="true"
						className="invisible text-sm font-semibold"
					>
						Remove
					</span>

					{/* `h-auto` undoes the `h-fit` the variant carries, which would otherwise
					 * keep the button at its icon's height and ignore the stretch. */}
					<Button
						type="button"
						variant="outline"
						hover="error"
						disabled={disabled}
						onClick={onRemove}
						aria-label={`Remove line ${index + 1}`}
						className="h-auto grow"
					>
						<Icons.Action.Delete className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-start gap-3">
				<FormComponentInput<OrderLineFormType>
					labelText="Quantity"
					id={elementIds[`line-${index}-quantity`]}
					fieldName="quantity"
					fieldValue={line.quantity ?? ''}
					isRequired={true}
					disabled={disabled}
					className="w-28"
					onChange={(e) =>
						onChange({ quantity: Number(e.target.value) })
					}
					error={ownErrorMessages(errors?.quantity)}
				/>

				<FormComponentInput<OrderLineFormType>
					labelText={`Unit price${currency ? ` (${currency})` : ''}`}
					id={elementIds[`line-${index}-price`]}
					fieldName="price"
					fieldValue={line.price ?? ''}
					isRequired={true}
					disabled={disabled}
					className="w-36"
					placeholderText="excl. VAT"
					onChange={(e) =>
						onChange({ price: Number(e.target.value) })
					}
					error={ownErrorMessages(errors?.price)}
				/>

				<FormComponentInput<OrderLineFormType>
					labelText="VAT %"
					id={elementIds[`line-${index}-vat`]}
					fieldName="vat_rate"
					fieldValue={line.vat_rate ?? ''}
					isRequired={true}
					disabled={disabled}
					className="w-28"
					onChange={(e) =>
						onChange({ vat_rate: Number(e.target.value) })
					}
					error={ownErrorMessages(errors?.vat_rate)}
				/>
			</div>

			{/*
			 * A row of its own, so the picker and the figure it asks for stay side by side - beside
			 * the three figures above, the value box wraps away from its picker on all but the
			 * widest window.
			 */}
			<div className="mt-4 flex flex-wrap items-start gap-3">
				<FormComponentSelect<OrderLineFormType>
					labelText="Discount"
					id={elementIds[`line-${index}-discount-type`]}
					fieldName="discount_type"
					fieldValue={line.discount_type ?? DISCOUNT_TYPE_NONE}
					disabled={disabled || !canDiscount}
					className="w-40"
					options={discountTypeOptions(currency)}
					onChange={(value) => {
						const type = toDiscountType(value);

						onChange({
							discount_type: type,
							...(type ? {} : { discount_value: null }),
						});
					}}
					error={ownErrorMessages(errors?.discount_type)}
				/>

				{line.discount_type && (
					<FormComponentInput<OrderLineFormType>
						labelText={
							line.discount_type === DiscountTypeEnum.PERCENT
								? 'Percent'
								: 'Per unit'
						}
						id={elementIds[`line-${index}-discount-value`]}
						fieldName="discount_value"
						fieldValue={line.discount_value ?? ''}
						isRequired={true}
						disabled={disabled || !canDiscount}
						className="w-28"
						onChange={(e) =>
							onChange({
								discount_value: toNullableNumber(
									e.target.value,
								),
							})
						}
						error={ownErrorMessages(errors?.discount_value)}
					/>
				)}
			</div>

			{clampWarning && (
				<p className="mt-2 text-sm text-warning">{clampWarning}</p>
			)}

			{line.product_id && (
				<OrderLineOptions
					index={index}
					productId={line.product_id}
					currency={currency}
					selected={line.options ?? []}
					disabled={disabled}
					error={ownErrorMessages(errors?.options)}
					onChange={(options) => onChange({ options })}
				/>
			)}

			{/*
			 * On a row of its own: the three figures above are fixed-width, so a note sharing
			 * their line gets whatever is left over - which on a narrow window is nothing, and it
			 * wraps to a full row anyway. Here it is always the width of the card.
			 */}
			<div className="mt-4">
				<FormComponentInput<OrderLineFormType>
					labelText="Notes"
					id={elementIds[`line-${index}-notes`]}
					fieldName="notes"
					fieldValue={line.notes ?? ''}
					isRequired={false}
					disabled={disabled}
					className="w-full"
					onChange={(e) => onChange({ notes: e.target.value })}
					error={ownErrorMessages(errors?.notes)}
				/>
			</div>
		</div>
	);
}

/** How many answers a question takes, in words - the pair of numbers is its only expression. */
function describeSelection(
	minSelect: number | null,
	maxSelect: number | null,
): string {
	const min = minSelect ?? 0;

	if (maxSelect === null) {
		return min === 0 ? 'optional, any number' : `at least ${min}`;
	}

	if (min === maxSelect) {
		return `exactly ${min}`;
	}

	return min === 0
		? `optional, up to ${maxSelect}`
		: `${min} to ${maxSelect}`;
}

/**
 * The questions the line's product asks, answered with one checkbox per answer.
 *
 * Read from the product itself (`GET /products/:id`), once per product - the listing row the
 * variant came from carries no option groups. A single-answer question swaps its answer on a new
 * pick rather than collecting a second one; the bounds are enforced by the backend either way, and
 * a required question left unanswered comes back as a 400 naming the variant.
 *
 * The delta shown is the one for the order's currency. It is not added to the unit price: the
 * operator types that figure with the deltas already included, as a checkout line states it.
 */
function OrderLineOptions({
	index,
	productId,
	currency,
	selected,
	disabled,
	error,
	onChange,
}: {
	readonly index: number;
	readonly productId: number;
	readonly currency: string | null;
	readonly selected: number[];
	readonly disabled: boolean;
	readonly error: string[] | undefined;
	readonly onChange: (options: number[]) => void;
}) {
	const { data: groups, isLoading } = useQuery({
		queryKey: ['order-line-option-groups', productId],
		queryFn: async (): Promise<ProductOptionGroupType[]> => {
			const product = await requestView<ProductModel>(
				'product',
				productId,
			);

			return product?.option_groups ?? [];
		},
	});

	if (isLoading) {
		return <p className="my-4 text-sm text-muted">Loading options...</p>;
	}

	if (!groups || groups.length === 0) {
		return null;
	}

	const language = getLanguageClient();

	const toggle = (
		group: ProductOptionGroupType,
		optionId: number,
		checked: boolean,
	) => {
		if (!checked) {
			onChange(selected.filter((id) => id !== optionId));

			return;
		}

		const groupIds = group.options.flatMap((option) =>
			option.id ? [option.id] : [],
		);

		const kept =
			group.max_select === 1
				? selected.filter((id) => !groupIds.includes(id))
				: selected;

		onChange([...kept, optionId]);
	};

	return (
		<div className="my-4 space-y-4">
			{groups.map((group) => (
				<fieldset key={group.id ?? group.label_id}>
					<legend className="text-sm font-semibold">
						{displayOptionLabel(
							group.label,
							language,
							group.label_id,
						)}{' '}
						<span className="font-normal text-muted">
							(
							{describeSelection(
								group.min_select,
								group.max_select,
							)}
							)
						</span>
					</legend>

					<div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
						{group.options.map((option) => {
							const optionId = option.id;

							if (!optionId) {
								return null;
							}

							const delta =
								option.prices.find(
									(price) => price.currency === currency,
								)?.price_delta ?? 0;

							const label = displayOptionLabel(
								option.label,
								language,
								option.label_id,
							);

							return (
								<FormComponentCheckbox<OrderLineFormType>
									key={optionId}
									id={`line-${index}-option-${optionId}`}
									fieldName="options"
									checked={selected.includes(optionId)}
									disabled={disabled}
									onCheckedChange={(checked) =>
										toggle(group, optionId, checked)
									}
								>
									{delta !== 0 && currency
										? `${label} (${delta > 0 ? '+' : ''}${displayOrderMoney(Number(delta), currency)})`
										: label}
								</FormComponentCheckbox>
							);
						})}
					</div>
				</fieldset>
			))}

			{error?.map((message) => (
				<p key={message} className="text-sm text-danger">
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

/**
 * Which fields each tab owns, for the error badge on the tab strip - so a problem on the panel
 * the operator cannot see still announces itself.
 *
 * Counted here rather than through `countTabErrors`: that helper exists for the translated
 * entities and takes a per-language error list and a content tab, neither of which an order has.
 */
const TAB_FIELDS: Record<FormTabId, readonly (keyof OrderFormValuesType)[]> = {
	details: ['client_id', 'notes'],
	lines: ['currency', 'lines', 'discount_type', 'discount_value'],
};

export function FormManageOrder() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<OrderFormValuesType>();

	const elementIds = useElementIds([
		'client',
		'currency',
		'notes',
		'discount-type',
		'discount-value',
	] as const);

	const { auth } = useAuth();

	/*
	 * Mirrors `OrderPolicy.mayDiscount`. The backend refuses only a change to what the document
	 * already carries, so without it the fields stay on screen, locked, and their values go back
	 * untouched.
	 */
	const canDiscount = hasPermission(auth, 'order', 'discount');

	const [searchClient, setSearchClient] = useState('');

	const { suggestions: clientSuggestions, isFetching: isClientFetching } =
		useRemoteAutocomplete<ClientModel>({
			query: searchClient,
			queryKey: ['s-order-client'],
			queryFn: async (term) => {
				const response:
					| FindFunctionResponseType<ClientModel>
					| undefined = await requestFind('client', {
					filter: { term: term },
					limit: 10,
				});

				return response?.entries ?? [];
			},
			minLength: 3,
		});

	/*
	 * Editable only while the document is pending - and always on a create, which has no status
	 * yet.
	 */
	const isEditable =
		formValues.status === null ||
		formValues.status === OrderStatusEnum.PENDING;

	const lines = formValues.lines ?? [];
	const lineErrors = errors.lines;

	/*
	 * Every line's floor in one request, for the clamp warning. Keyed on the sorted ids so editing
	 * a quantity does not refetch, and picking another variant does.
	 */
	const variantIds = [
		...new Set(
			lines.flatMap((line) => (line.variant_id ? [line.variant_id] : [])),
		),
	].sort((left, right) => left - right);

	const { data: variantsById } = useQuery({
		queryKey: ['order-line-variants', variantIds],
		queryFn: () => findVariantsByIds(variantIds),
		enabled: isEditable && variantIds.length > 0,
	});

	const updateLine = (index: number, patch: Partial<OrderLineFormType>) => {
		handleChange(
			'lines',
			lines.map((line, position) =>
				position === index ? { ...line, ...patch } : line,
			),
		);
	};

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
					 * The id is what the backend takes; the visible box carries the label only. Both are
					 * submitted so a failed validation redraws the box with the client already picked.
					 */}
					<input
						type="hidden"
						name="client_id"
						value={formValues.client_id ?? ''}
					/>
					{/*
					 * Never sent to the API - `prepareParamsFromFormValues` strips it - but it has
					 * to survive the round trip through `FormData`, because that is what tells the
					 * submit whether the line set may go with the update. Empty on a create.
					 */}
					<input
						type="hidden"
						name="status"
						value={formValues.status ?? ''}
					/>
					<input
						type="hidden"
						name="client_label"
						value={formValues.client ?? ''}
					/>
					<FormComponentAutoComplete<OrderFormValuesType, ClientModel>
						labelText="Client"
						id={elementIds.client}
						fieldName="client"
						fieldValue={formValues.client ?? ''}
						className="pl-8"
						isRequired={true}
						disabled={pending}
						error={errors.client_id}
						onInputChange={(value) => {
							handleChange('client', value);
							handleChange('client_id', null);
							setSearchClient(value);
						}}
						autoCompleteProps={{
							suggestions: clientSuggestions,
							isLoading: isClientFetching,
							onSelect: (client) => {
								handleChange(
									'client',
									displayClientLabel(client),
								);
								handleChange('client_id', client.id);
							},
							getOptionLabel: (client) =>
								displayClientLabel(client),
							getOptionKey: (client) => client.id,
						}}
						icons={{
							left: (
								<Icons.Client className="opacity-40 h-4.5 w-4.5" />
							),
						}}
					/>

					<FormComponentTextarea<OrderFormValuesType>
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
			 * Force-mounted like every `TabsContent`, so the hidden `lines` field below reaches
			 * `FormData` whether or not this panel is the one on screen - which is what lets the
			 * editor own its own input instead of hoisting it out of the tab it belongs to.
			 */}
			<TabsContent id="lines">
				<div className="form-section">
					{/* No heading - the tab is already called Lines */}
					<div className="flex flex-wrap items-end gap-2">
						{isEditable ? (
							/*
							 * It belongs beside the lines it stamps: no order row holds a
							 * currency, so this figure reaches the document only through the line
							 * set written under it - which is also why it locks when they do.
							 */
							<FormComponentSelect<OrderFormValuesType>
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
						) : (
							/*
							 * Submitted though nothing can be typed into it: the shared `manage`
							 * schema requires a currency on both actions, and the rows below label
							 * every figure with it. No caption beside them - each amount already
							 * carries the code.
							 */
							<input
								type="hidden"
								name="currency"
								value={formValues.currency ?? ''}
							/>
						)}
					</div>

					{/*
					 * Always submitted, whatever is on screen: the picker below is not rendered
					 * once the lines lock, and a disabled field leaves `FormData` - either way the
					 * order-wide discount would read as cleared, which the backend takes as a
					 * change only `order.discount` may make.
					 */}
					<input
						type="hidden"
						name="order_discount_type"
						value={formValues.discount_type ?? ''}
					/>
					<input
						type="hidden"
						name="order_discount_value"
						value={formValues.discount_value ?? ''}
					/>

					{isEditable && (
						<div className="flex flex-wrap items-start gap-3">
							<FormComponentSelect<OrderFormValuesType>
								labelText="Order discount"
								id={elementIds['discount-type']}
								fieldName="discount_type"
								fieldValue={
									formValues.discount_type ??
									DISCOUNT_TYPE_NONE
								}
								disabled={pending || !canDiscount}
								className="w-40"
								options={discountTypeOptions(
									formValues.currency,
								)}
								onChange={(value) => {
									const type = toDiscountType(value);

									handleChange('discount_type', type);

									if (!type) {
										handleChange('discount_value', null);
									}
								}}
								error={errors.discount_type}
							/>

							{formValues.discount_type && (
								<FormComponentInput<OrderFormValuesType>
									labelText={
										formValues.discount_type ===
										DiscountTypeEnum.PERCENT
											? 'Percent'
											: 'Amount'
									}
									id={elementIds['discount-value']}
									fieldName="discount_value"
									fieldValue={formValues.discount_value ?? ''}
									isRequired={true}
									disabled={pending || !canDiscount}
									className="w-28"
									onChange={(e) =>
										handleChange(
											'discount_value',
											toNullableNumber(e.target.value),
										)
									}
									error={errors.discount_value}
								/>
							)}
						</div>
					)}

					{isEditable && (
						/*
						 * Said once, at the top. A discount left on "Catalog rules" is resolved by
						 * the backend on save; a typed one replaces that pass - and either way the
						 * figures only appear after the save, because both are clamped there.
						 */
						<p className="text-sm text-muted">
							{canDiscount
								? "Leave a discount on Catalog rules and the catalog's own rules apply when the order is saved. A typed discount replaces them - on a line in place of its rule, order-wide in place of a campaign - and is still clamped against each market's minimum price."
								: "Discounts come from the catalog's own rules, applied when the order is saved and clamped against each market's minimum price. Typing one needs the order discount permission."}
						</p>
					)}

					{/*
					 * The whole list in one hidden field. Per-input names cannot express a list of
					 * objects, and the pipeline reads it back with `getFormDataAsJsonList`.
					 */}
					<input
						type="hidden"
						name="lines"
						value={JSON.stringify(lines)}
					/>

					{!isEditable && (
						<>
							<p className="text-sm text-muted">
								An order that has been confirmed keeps the lines
								it was accepted with - only a pending order can
								have them changed.
							</p>

							<OrderLinesReadOnly
								lines={lines}
								currency={formValues.currency}
							/>
						</>
					)}

					{ownErrorMessages(lineErrors)?.map((message) => (
						<p key={message} className="text-sm text-danger">
							{message}
						</p>
					))}

					{isEditable && (
						<div className="flex flex-col gap-3">
							{lines.map((line, index) => (
								<OrderLineRow
									key={line.key}
									line={line}
									index={index}
									currency={formValues.currency}
									disabled={pending}
									canDiscount={canDiscount}
									minPrice={
										line.variant_id === null ||
										variantsById === undefined
											? undefined
											: (variantsById
													.get(line.variant_id)
													?.prices?.find(
														(price) =>
															price.currency ===
															formValues.currency,
													)?.min_price ?? null)
									}
									errors={rowErrorsAt<OrderLineFormType>(
										lineErrors,
										index,
									)}
									onChange={(patch) =>
										updateLine(index, patch)
									}
									onRemove={() =>
										handleChange(
											'lines',
											lines.filter(
												(_, position) =>
													position !== index,
											),
										)
									}
								/>
							))}

							{/*
							 * Under the rows it appends to, so the operator's eye ends where the next
							 * line will show up rather than back at the top of the list.
							 */}
							<Button
								type="button"
								variant="outline"
								className="self-start"
								disabled={
									pending || lines.length >= ORDER_LINES_MAX
								}
								onClick={() =>
									handleChange('lines', [
										...lines,
										emptyOrderLine(),
									])
								}
							>
								<Icons.Action.Add className="h-4 w-4" />
								Add line
							</Button>
						</div>
					)}
				</div>
			</TabsContent>
		</Tabs>
	);
}
