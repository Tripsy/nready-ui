import { useQuery } from '@tanstack/react-query';
import { type JSX, useMemo } from 'react';
import { FormAttributesProduct } from '@/app/(dashboard)/dashboard/product/form-attributes-product.component';
import {
	FormComponentCheckbox,
	FormComponentInput,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { Configuration } from '@/config/settings.config';
import { formatAmount } from '@/helpers/display.helper';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import type {
	ProductPriceType,
	ProductVariantType,
} from '@/models/product.model';
import type {
	ProductAttributeFormType,
	ProductCategoryAttributeModel,
} from '@/models/product-category-attribute.model';
import { requestLatestExchangeRates } from '@/services/exchange-rate.service';
import { CurrencyEnum } from '@/types/common.type';
import type { FormErrorsType } from '@/types/form.type';

/**
 * A variant as the form holds it. `key` is client-only - the list needs a stable React key per
 * row, and a variant has none of its own: `sku` starts empty and may be edited, and the array
 * index is exactly what a reorder changes, so keying by it would leave the moved rows' inputs
 * holding their old neighbor's state. Stripped before the payload is built.
 */
export type ProductVariantFormType = Omit<ProductVariantType, 'attributes'> & {
	key: string;
	/**
	 * The axes that tell this variant from its siblings, as the form holds them. Always a list
	 * - an omitted key would leave the stored values alone, and the editor showing no value for
	 * an axis means it has none, not that it declines to say.
	 */
	attributes: ProductAttributeFormType[];
};

/*
 * Not `crypto.randomUUID()`: that needs a secure context, and the dev host is plain http, so it
 * would throw where it is most convenient to test. Uniqueness only has to hold within one form.
 */
let variantKeySequence = 0;

export function nextVariantKey(): string {
	variantKeySequence += 1;

	return `variant-${variantKeySequence}`;
}

/*
 * The books are kept in one currency, so `cost_price` carries no currency column of its own -
 * it is always this one, whatever markets the variant is priced for.
 */
const BASE_CURRENCY = Configuration.get('app.currency');

/**
 * The markets a price may be quoted in. A closed list rather than a free-text code: the column is
 * `char(3)` and `(variant_id, currency)` is unique, so a typo does not fail - it silently creates
 * a second market nothing sells in.
 */
const CURRENCY_OPTIONS = toOptionsFromEnum(CurrencyEnum);

/**
 * Column widths shared by the price table's header and its row cells.
 *
 * The rows are flex, not a real `<table>`, because each field is a `FormElement` carrying its
 * own error slot - so nothing aligns the two unless both sides name the same width.
 *
 * That error slot is also why the width goes on the cell wrapper rather than the control, with
 * `shrink-0`: a field's wrapper grows to fit the message under it, and a wide one would
 * otherwise push everything to its right - the remove button included - out of line.
 */
const PRICE_COLUMN = {
	currency: 'w-28 shrink-0',
	amount: 'w-32 shrink-0',
} as const;

/** Low-stock thresholds are shelf counts, so three digits is the whole useful range. */
const THRESHOLD_MAX_DIGITS = 3;

/**
 * A base-currency figure as one string. `formatAmount` returns the number and the symbol apart,
 * for callers that style them separately - inside a sentence they are simply joined.
 */
function displayBaseAmount(amount: number): string {
	const { value, currency } = formatAmount(amount, BASE_CURRENCY);

	return `${value} ${currency}`;
}

function emptyPrice(): ProductPriceType {
	return {
		currency: BASE_CURRENCY,
		sale_price: null,
		reference_price: null,
		min_price: null,
	};
}

export function emptyVariant(
	position: number,
	isFirst: boolean,
): ProductVariantFormType {
	return {
		key: nextVariantKey(),
		sku: '',
		barcode: null,
		position,
		// The first variant of a new product is the default one; the backend requires exactly
		// one, and offering an empty set the user has to remember to mark is a needless trap.
		is_default: isFirst,
		track_stock: false,
		// Not `0`, which is a real threshold ("warn at nothing left") rather than an empty one.
		low_stock_threshold: null,
		allow_backorder: false,
		cost_price: null,
		prices: [emptyPrice()],
		// Reconciled against the `variant`-scoped definitions as soon as `resolve` answers
		attributes: [],
	};
}

/**
 * A typed low-stock threshold, capped at three digits.
 *
 * `maxLength` does nothing on `type="number"`, so the cap is applied to the value itself: the
 * digits are taken as text and truncated, which stops the field at 999 while a typed fourth digit
 * simply does not appear. A `max` attribute would not do the same - it leaves the value in place
 * and only marks the input invalid.
 */
function parseThreshold(value: string): number | null {
	const digits = value.replace(/\D/g, '').slice(0, THRESHOLD_MAX_DIGITS);

	return digits === '' ? null : Number(digits);
}

/**
 * Everything worth saying out loud about one price row.
 *
 * A list rather than one verdict: the floor rules and the reference-price rule are independent,
 * and a row can trip both. Each note carries its own tone - a missing floor is worth stating but
 * is not a mistake, so it reads as information; the rest describe something the operator probably
 * did not intend.
 *
 * `resolveFloor` in the backend's `discount-resolution.service` clamps to `min_price` and to
 * nothing else - cost is an accounting figure and is deliberately not a fallback floor:
 *
 * - `below-cost` - a floor is set and sits under what the goods cost. The engine honors it
 *   outright, which is intended (a campaign may deliberately sell at a loss), but the figures are
 *   not in the same currency by default: `min_price` belongs to the market its row quotes while
 *   `cost_price` is a single base-currency number, so a floor that looks comfortable beside an EUR
 *   price can sit under cost once converted. Nothing on either side catches it - the table's
 *   `min_price <= price` check compares two figures in the same row, and the backend never sees
 *   the cost and the floor together. It is a margin observation, not a rule: selling under cost is
 *   allowed, and this only makes it deliberate rather than accidental.
 * - `reference-below-sale` - `reference_price` means "the usual price", so one below the sale
 *   price advertises a saving that is really an increase. Both figures sit in the row's own
 *   currency, so no conversion is involved. The table only checks `reference_price > 0` and no
 *   pricing path reads the column at all, which is why a transposed figure here reaches the
 *   storefront unchallenged.
 *
 * `unknown-rate` is deliberately not silence - an unanswerable comparison has to read as
 * unanswered, or an operator takes the absence of a warning for a pass.
 */
type PriceRowNoteType =
	| { tone: 'warning'; kind: 'below-cost'; floorInBase: number }
	| { tone: 'warning'; kind: 'unknown-rate' }
	| { tone: 'warning'; kind: 'reference-below-sale' };

function resolvePriceRowNotes(
	costPrice: number | null,
	price: ProductPriceType,
	rates: Record<string, number> | undefined,
): PriceRowNoteType[] {
	const notes: PriceRowNoteType[] = [];

	// Equal is not flagged: it advertises no saving rather than a false one.
	if (
		price.reference_price !== null &&
		price.sale_price !== null &&
		price.reference_price < price.sale_price
	) {
		notes.push({ tone: 'warning', kind: 'reference-below-sale' });
	}

	if (price.min_price === null) {
		return notes;
	}

	if (costPrice === null) {
		return notes;
	}

	const currency = price.currency.trim().toUpperCase();

	const floorInBase =
		currency === BASE_CURRENCY
			? price.min_price
			: // One unit of the row's currency in base currency, so the floor multiplies by it.
				price.min_price * (rates?.[currency] ?? 0);

	if (currency !== BASE_CURRENCY && !rates?.[currency]) {
		notes.push({ tone: 'warning', kind: 'unknown-rate' });

		return notes;
	}

	if (floorInBase < costPrice) {
		notes.push({ tone: 'warning', kind: 'below-cost', floorInBase });
	}

	return notes;
}

type RowProps = {
	variant: ProductVariantFormType;
	index: number;
	disabled: boolean;
	errors?: FormErrorsType<ProductVariantFormType>;
	idPrefix: string;
	onUpdate: (index: number, patch: Partial<ProductVariantFormType>) => void;
	onMarkDefault: (index: number) => void;
	onRemove: (index: number) => void;
	/** `-1` / `+1`; the buttons are disabled at the ends, so there is no range to check. */
	onMove: (index: number, offset: number) => void;
	isLast: boolean;
	onUpdatePrice: (
		variantIndex: number,
		priceIndex: number,
		patch: Partial<ProductPriceType>,
	) => void;
	/** Latest rate to base currency per currency code; absent while the lookup is in flight. */
	rates?: Record<string, number>;
	/** The `variant`-scoped definitions this product's categories declare. */
	attributeDefinitions: ProductCategoryAttributeModel[];
	onDefinitionsChanged?: () => void;
};

function VariantRow({
	variant,
	index,
	disabled,
	errors: variantErrors,
	idPrefix,
	onUpdate,
	onMarkDefault,
	onRemove,
	onMove,
	isLast,
	onUpdatePrice,
	rates,
	attributeDefinitions,
	onDefinitionsChanged,
}: RowProps): JSX.Element {
	/*
	 * `?? []` because a variant can reach here without the key at all: `WindowForm` persists the
	 * form's values as a draft and restores them on reopen, so a draft written before this field
	 * existed comes back a shape older than the type says.
	 */
	const attributeValues = variant.attributes ?? [];

	// The validator reports on the entry; the field component addresses them by label
	const attributeErrors = Object.fromEntries(
		attributeValues.map((value, position) => [
			value.attribute_label_id,
			(
				variantErrors?.attributes as
					| Record<number, string[] | undefined>
					| undefined
			)?.[position],
		]),
	);

	return (
		<li>
			<fieldset className="rounded-md border border-line p-3 space-y-8">
				<div className="flex items-center justify-between gap-3">
					<FormComponentCheckbox<ProductVariantType>
						id={`${idPrefix}-${index}-default`}
						fieldName="is_default"
						checked={variant.is_default}
						disabled={disabled || variant.is_default}
						onCheckedChange={() => onMarkDefault(index)}
					>
						Default variant
					</FormComponentCheckbox>

					<div className="flex items-center">
						<Button
							type="button"
							variant="ghost"
							hover="info"
							disabled={disabled || index === 0}
							onClick={() => onMove(index, -1)}
							className="p-2 disabled:opacity-30"
							aria-label={`Move variant ${index + 1} up`}
							title={`Move variant up`}
						>
							<Icons.Direction.ArrowUp className="h-4 w-4" />
						</Button>

						<Button
							type="button"
							variant="ghost"
							hover="info"
							disabled={disabled || isLast}
							onClick={() => onMove(index, 1)}
							className="p-2 disabled:opacity-30"
							aria-label={`Move variant ${index + 1} down`}
							title={`Move variant down`}
						>
							<Icons.Direction.ArrowDown className="h-4 w-4" />
						</Button>

						<Button
							type="button"
							variant="ghost"
							hover="error"
							disabled={disabled}
							onClick={() => onRemove(index)}
							className="p-2 disabled:opacity-30"
							aria-label={`Remove variant ${index + 1}`}
							title={`Remove variant`}
						>
							<Icons.Action.Delete className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<FormComponentInput<ProductVariantType>
							id={`${idPrefix}-${index}-sku`}
							labelText="Variant SKU"
							fieldName="sku"
							fieldValue={variant.sku}
							isRequired={true}
							placeholderText="eg: PIZZA-MARG-30"
							disabled={disabled}
							onChange={(e) =>
								onUpdate(index, { sku: e.target.value })
							}
							error={variantErrors?.sku}
						/>

						<FormComponentInput<ProductVariantType>
							id={`${idPrefix}-${index}-barcode`}
							labelText="Barcode"
							fieldName="barcode"
							fieldValue={variant.barcode ?? ''}
							disabled={disabled}
							onChange={(e) =>
								onUpdate(index, {
									barcode: e.target.value || null,
								})
							}
							error={variantErrors?.barcode}
						/>
					</div>

					<div>
						<FormComponentInput<ProductVariantType>
							id={`${idPrefix}-${index}-cost-price`}
							labelText="Cost Price"
							fieldType="number"
							fieldName="cost_price"
							fieldValue={variant.cost_price ?? ''}
							disabled={disabled}
							onChange={(e) =>
								onUpdate(index, {
									cost_price:
										e.target.value === ''
											? null
											: Number(e.target.value),
								})
							}
							error={variantErrors?.cost_price}
							className="max-w-32"
						/>

						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								What the goods cost you, in {BASE_CURRENCY} -
								never charged, never shown to customers.
							</span>
						</p>
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="text-sm font-semibold border-b border-line pb-2">
						Stock management
					</h3>

					<p className="flex items-start gap-1 text-xs text-muted">
						<Icons.Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						Off for anything not counted - a dish, a download. The
						two settings beside it apply only while it is on, and
						are cleared when it is turned off.
					</p>

					<div className="flex flex-wrap items-center gap-4">
						<FormComponentCheckbox<ProductVariantType>
							id={`${idPrefix}-${index}-track-stock`}
							fieldName="track_stock"
							checked={variant.track_stock}
							disabled={disabled}
							onCheckedChange={(checked) =>
								onUpdate(index, {
									track_stock: checked,
									/*
									 * Both fields below only mean anything against a tracked
									 * quantity, so untracking clears them rather than leaving
									 * settings that read as deliberate and do nothing. Disabling
									 * the controls is not enough on its own - the row rides in a
									 * hidden JSON field, which a disabled input does not exclude.
									 */
									...(checked
										? {}
										: {
												low_stock_threshold: null,
												allow_backorder: false,
											}),
								})
							}
							error={variantErrors?.track_stock}
						>
							Track stock
						</FormComponentCheckbox>
					</div>

					<div className="flex flex-wrap gap-4">
						<FormComponentInput<ProductVariantType>
							id={`${idPrefix}-${index}-low-stock`}
							labelText="Low stock threshold"
							fieldType="number"
							fieldName="low_stock_threshold"
							fieldValue={variant.low_stock_threshold ?? ''}
							className="w-20"
							disabled={disabled || !variant.track_stock}
							onChange={(e) =>
								onUpdate(index, {
									low_stock_threshold: parseThreshold(
										e.target.value,
									),
								})
							}
							error={variantErrors?.low_stock_threshold}
						/>
						<FormComponentCheckbox<ProductVariantType>
							id={`${idPrefix}-${index}-allow-backorder`}
							fieldName="allow_backorder"
							checked={variant.allow_backorder}
							disabled={disabled || !variant.track_stock}
							onCheckedChange={(checked) =>
								onUpdate(index, { allow_backorder: checked })
							}
							error={variantErrors?.allow_backorder}
						>
							Allow backorder
						</FormComponentCheckbox>
					</div>
				</div>

				<div className="space-y-4">
					<div className="border-b border-line pb-2">
						<h3 className="text-sm font-semibold">Pricing</h3>
					</div>

					<div>
						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								Each product variant has its own prices.
							</span>
						</p>
						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								<strong className="font-semibold">
									Sale price
								</strong>{' '}
								is what the customer is charged, excluding VAT.
							</span>
						</p>

						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								<strong className="font-semibold">
									Reference price
								</strong>{' '}
								is the usual price the sale is measured against
								- shown to signal a saving.
							</span>
						</p>

						<p className="mt-1 flex items-center gap-1 text-xs text-muted">
							<Icons.Info className="h-3.5 w-3.5 shrink-0" />

							<span>
								The discounted price cannot drop below the set{' '}
								<strong className="font-semibold">
									minimum price
								</strong>
							</span>
						</p>
					</div>

					<div className="flex flex-nowrap gap-2 text-sm font-semibold">
						<span className={PRICE_COLUMN.currency}>
							Currency
							<span className="ml-1 text-danger">*</span>
						</span>
						<span className={PRICE_COLUMN.amount}>
							Sale price
							<span className="ml-1 text-danger">*</span>
						</span>
						<span className={PRICE_COLUMN.amount}>
							Reference price
						</span>
						<span className={PRICE_COLUMN.amount}>
							Minimum price
						</span>
					</div>

					{variant.prices.map((price, priceIndex) => {
						const priceErrors = variantErrors?.prices?.[priceIndex];
						const priceKey = `${variant.key}-price-${priceIndex}`;
						const priceNotes = resolvePriceRowNotes(
							variant.cost_price,
							price,
							rates,
						);

						return (
							<div key={priceKey}>
								<div className="flex flex-nowrap items-start gap-2">
									{/* The width is on the cell, not the control - see PRICE_COLUMN. */}
									<div className={PRICE_COLUMN.currency}>
										<FormComponentSelect<ProductPriceType>
											id={`${idPrefix}-${index}-price-${priceIndex}-currency`}
											fieldName="currency"
											fieldValue={price.currency}
											isRequired={true}
											className="w-full"
											ariaLabel="Currency"
											options={CURRENCY_OPTIONS}
											disabled={disabled}
											onChange={(value) =>
												onUpdatePrice(
													index,
													priceIndex,
													{ currency: value },
												)
											}
											error={priceErrors?.currency}
										/>
									</div>

									<div className={PRICE_COLUMN.amount}>
										<FormComponentInput<ProductPriceType>
											id={`${idPrefix}-${index}-price-${priceIndex}-sale-price`}
											fieldType="number"
											fieldName="sale_price"
											fieldValue={price.sale_price ?? ''}
											isRequired={true}
											className="w-full"
											ariaLabel="Sale price"
											disabled={disabled}
											onChange={(e) =>
												onUpdatePrice(
													index,
													priceIndex,
													{
														sale_price:
															e.target.value ===
															''
																? null
																: Number(
																		e.target
																			.value,
																	),
													},
												)
											}
											error={priceErrors?.sale_price}
										/>
									</div>

									<div className={PRICE_COLUMN.amount}>
										<FormComponentInput<ProductPriceType>
											id={`${idPrefix}-${index}-price-${priceIndex}-reference-price`}
											fieldType="number"
											fieldName="reference_price"
											fieldValue={
												price.reference_price ?? ''
											}
											className="w-full"
											ariaLabel="Reference price"
											disabled={disabled}
											onChange={(e) =>
												onUpdatePrice(
													index,
													priceIndex,
													{
														reference_price:
															e.target.value ===
															''
																? null
																: Number(
																		e.target
																			.value,
																	),
													},
												)
											}
											error={priceErrors?.reference_price}
										/>
									</div>

									<div className={PRICE_COLUMN.amount}>
										<FormComponentInput<ProductPriceType>
											id={`${idPrefix}-${index}-price-${priceIndex}-min-price`}
											fieldType="number"
											fieldName="min_price"
											fieldValue={price.min_price ?? ''}
											className="w-full"
											ariaLabel="Minimum price"
											disabled={disabled}
											onChange={(e) =>
												onUpdatePrice(
													index,
													priceIndex,
													{
														min_price:
															e.target.value ===
															''
																? null
																: Number(
																		e.target
																			.value,
																	),
													},
												)
											}
											error={priceErrors?.min_price}
										/>
									</div>

									{variant.prices.length > 1 ? (
										<Button
											type="button"
											variant="ghost"
											hover="error"
											onClick={() =>
												onUpdate(index, {
													prices: variant.prices.filter(
														(_, current) =>
															current !==
															priceIndex,
													),
												})
											}
											className="mt-1 p-2 opacity-60 hover:opacity-100"
											aria-label={`Remove price ${priceIndex + 1}`}
											title={`Remove price`}
										>
											<Icons.Close className="h-4 w-4" />
										</Button>
									) : null}
								</div>

								{priceNotes.map((note) => (
									<p
										key={note.kind}
										className="mt-1 flex items-start gap-1 text-xs text-warning"
									>
										<Icons.Status.Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />

										{note.kind === 'below-cost' && (
											<span>
												A discount may resolve to{' '}
												{displayBaseAmount(
													note.floorInBase,
												)}
												, below the{' '}
												{displayBaseAmount(
													variant.cost_price ?? 0,
												)}{' '}
												this variant cost.
											</span>
										)}

										{note.kind === 'unknown-rate' && (
											<span>
												No {BASE_CURRENCY} rate for{' '}
												{price.currency.toUpperCase()} -
												this floor cannot be checked
												against the cost price.
											</span>
										)}

										{note.kind ===
											'reference-below-sale' && (
											<span>
												The reference price is below the
												sale price, so it advertises an
												increase rather than a saving.
											</span>
										)}
									</p>
								))}
							</div>
						);
					})}

					<div className="flex justify-end">
						<Button
							type="button"
							variant="ghost"
							hover="success"
							disabled={disabled}
							onClick={() =>
								onUpdate(index, {
									prices: [...variant.prices, emptyPrice()],
								})
							}
							className="p-2 opacity-80 hover:opacity-100"
							title="Add currency"
						>
							<Icons.Action.Add className="h-4 w-4" /> Add
							currency
						</Button>
					</div>
				</div>

				{/*
				 * The axes that tell this variant from its siblings. Rendered per row rather
				 * than once for the product because that is the whole point of the `variant`
				 * scope - the same question, answered differently by each.
				 */}
				{attributeDefinitions.length > 0 && (
					<div className="space-y-2">
						<h4 className="font-bold">Attributes</h4>

						<FormAttributesProduct
							definitions={attributeDefinitions}
							values={attributeValues}
							onChange={(attributes) =>
								onUpdate(index, { attributes })
							}
							errors={attributeErrors}
							disabled={disabled}
							idPrefix={`${idPrefix}-${index}`}
							onDefinitionsChanged={onDefinitionsChanged}
						/>
					</div>
				)}
			</fieldset>
		</li>
	);
}

type Props = {
	value: ProductVariantFormType[];
	onChange: (value: ProductVariantFormType[]) => void;
	disabled: boolean;
	errors?: FormErrorsType<ProductVariantFormType>[];
	/**
	 * The two set-wide rules - exactly one default, no repeated SKU. They arrive on their own
	 * sentinel field rather than on `variants`, which already holds one error object per row.
	 */
	ruleError?: string[];
	/**
	 * The `variant`-scoped definitions, resolved once for the product and handed to every row:
	 * an axis is declared by the product's categories, so it is the same question for each.
	 */
	attributeDefinitions: ProductCategoryAttributeModel[];
	/** Passed straight through to every row - see `FormAttributesProduct`. */
	onDefinitionsChanged?: () => void;
};

export function FormVariantsProduct({
	value,
	onChange,
	disabled,
	errors,
	ruleError,
	attributeDefinitions,
	onDefinitionsChanged,
}: Props): JSX.Element {
	const elementIds = useElementIds(['variant'] as const);

	/*
	 * Only the currencies a cost can actually be compared against: not the base currency, which
	 * needs no rate, and only while some variant carries a cost to compare with. Sorted so that
	 * reordering the price rows does not look like a new key. Every value comes from the select,
	 * so there is no half-typed code to guard against.
	 */
	const quotedCurrencies = useMemo(() => {
		if (!value.some((variant) => variant.cost_price !== null)) {
			return [];
		}

		const currencies = new Set<string>();

		for (const variant of value) {
			for (const price of variant.prices) {
				const currency = price.currency.trim().toUpperCase();

				if (currency !== BASE_CURRENCY) {
					currencies.add(currency);
				}
			}
		}

		return [...currencies].sort();
	}, [value]);

	/*
	 * A missing rate is a fact the warning reports rather than a failure, so the query is left
	 * to resolve with the currencies it could answer for - see the service. One request set per
	 * distinct currency list, cached for the provider's five minutes.
	 */
	const { data: rates } = useQuery({
		queryKey: ['exchange-rate', 'latest', quotedCurrencies.join(',')],
		queryFn: () => requestLatestExchangeRates(quotedCurrencies),
		enabled: quotedCurrencies.length > 0,
	});

	/**
	 * `position` is the order of the list, not a field: it is re-stamped from the index after
	 * anything that moves a row, so what the user sees and what the backend stores agree.
	 */
	const commit = (variants: ProductVariantFormType[]) => {
		onChange(
			variants.map((variant, position) => ({ ...variant, position })),
		);
	};

	const updateVariant = (
		index: number,
		patch: Partial<ProductVariantFormType>,
	) => {
		onChange(
			value.map((variant, current) =>
				current === index ? { ...variant, ...patch } : variant,
			),
		);
	};

	/** Default is a property of the set, not of a row - marking one unmarks the rest. */
	const markDefault = (index: number) => {
		onChange(
			value.map((variant, current) => ({
				...variant,
				is_default: current === index,
			})),
		);
	};

	const addVariant = () => {
		commit([...value, emptyVariant(value.length, value.length === 0)]);
	};

	/** Swaps with the neighbour and re-stamps `position` through `commit`. */
	const moveVariant = (index: number, offset: number) => {
		const target = index + offset;
		const reordered = [...value];

		[reordered[index], reordered[target]] = [
			reordered[target],
			reordered[index],
		];

		commit(reordered);
	};

	const removeVariant = (index: number) => {
		const remaining = value.filter((_, current) => current !== index);

		// Removing the default leaves the set without one, which the validator rejects - hand
		// the flag to the first survivor instead of making the user notice.
		if (remaining.length > 0 && !remaining.some((v) => v.is_default)) {
			remaining[0] = { ...remaining[0], is_default: true };
		}

		commit(remaining);
	};

	const updatePrice = (
		variantIndex: number,
		priceIndex: number,
		patch: Partial<ProductPriceType>,
	) => {
		const variant = value[variantIndex];

		updateVariant(variantIndex, {
			prices: variant.prices.map((price, current) =>
				current === priceIndex ? { ...price, ...patch } : price,
			),
		});
	};

	return (
		<div className="space-y-3">
			{/* Listed rather than joined: these are independent rules, and running two of them
			    into one sentence reads as a single garbled message. */}
			{ruleError?.length === 1 ? (
				<p className="text-sm text-danger">{ruleError[0]}</p>
			) : ruleError?.length ? (
				<ul className="text-sm text-danger">
					{ruleError.map((message) => (
						<li key={message}>- {message}</li>
					))}
				</ul>
			) : null}

			{value.length === 0 ? (
				<p className="text-sm text-muted">
					A product is priced and stocked through its variants, so at
					least one is required - add a single variant if there is
					nothing to vary.
				</p>
			) : (
				<ul className="space-y-3">
					{value.map((variant, index) => (
						<VariantRow
							key={variant.key}
							variant={variant}
							index={index}
							disabled={disabled}
							errors={errors?.[index]}
							idPrefix={elementIds.variant}
							onUpdate={updateVariant}
							onMarkDefault={markDefault}
							onRemove={removeVariant}
							onMove={moveVariant}
							isLast={index === value.length - 1}
							onUpdatePrice={updatePrice}
							rates={rates}
							attributeDefinitions={attributeDefinitions}
							onDefinitionsChanged={onDefinitionsChanged}
						/>
					))}
				</ul>
			)}

			<div className="flex">
				<Button
					type="button"
					variant="ghost"
					hover="success"
					disabled={disabled}
					onClick={addVariant}
					className="p-2 opacity-80 hover:opacity-100"
				>
					<Icons.Action.Add className="h-4 w-4" /> Add variant
				</Button>
			</div>

			{/*
			 * The whole set as one field. `processForm` rebuilds its values from `FormData`, and
			 * the nested prices make per-input names unworkable - the same approach `brand` uses
			 * for its per-language contents.
			 */}
			<input
				type="hidden"
				name="variants"
				value={JSON.stringify(value)}
			/>
		</div>
	);
}
