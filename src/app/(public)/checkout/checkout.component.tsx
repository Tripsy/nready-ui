'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import type React from 'react';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import {
	type BillingEditor,
	type BillingValues,
	CHECKOUT_INITIAL_VALUES,
	CHECKOUT_TRANSLATION_KEYS,
	type CheckoutTranslations,
	type CheckoutValues,
	DELIVERY_METHOD_OPTIONS,
	getBillingParams,
	getBillingValuesFromClient,
	getDefaultBillingValues,
	hasErrors,
	PAYMENT_METHOD_OPTIONS,
	toPaymentMethod,
	toShippingMethod,
	validateBilling,
	validateCheckout,
} from '@/app/(public)/checkout/checkout.definition';
import { CheckoutAddresses } from '@/app/(public)/checkout/checkout-addresses.component';
import { CheckoutBilling } from '@/app/(public)/checkout/checkout-billing.component';
import {
	FormComponentRadio,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { getResponseData } from '@/helpers/api.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { CART_QUERY_KEY, useCart } from '@/hooks/use-cart.hook';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type CartCheckoutModel,
	displayCartLineName,
	getCartDiscountGross,
	getCartLineGrossTotal,
	getCartLineGrossUnitPrice,
	groupCartComponents,
} from '@/models/cart.model';
import type { ClientModel } from '@/models/client.model';
import { ClientAddressTypeEnum } from '@/models/client-address.model';
import { ShippingMethodEnum } from '@/models/order.model';
import { roundMoney } from '@/models/product.model';
import { useAuth } from '@/providers/auth.provider';
import { useToast } from '@/providers/toast.provider';
import { requestCartCheckout } from '@/services/cart.service';
import {
	requestCreateOwnClient,
	requestOwnClients,
	requestUpdateOwnClient,
} from '@/services/client.service';

/** The account's own clients - the bill-to choices. */
const OWN_CLIENTS_QUERY_KEY = ['client', 'own'] as const;

/**
 * Delivery is not priced yet - the backend writes the shipment at zero - so the summary states it
 * as zero, matching the basket.
 */
const DELIVERY_COST = 0;

function money(value: number, currency: string): string {
	return `${value.toFixed(2)} ${currency}`;
}

const linkClassName =
	'inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent';

function Section({
	title,
	children,
}: {
	readonly title: string;
	readonly children: React.ReactNode;
}) {
	return (
		/*
		 * `form-section` is what `globals.css` scopes the field styles under - without it a field's
		 * left icon and clear button lose their absolute positioning and render outside the input.
		 * `gap-4` keeps the section tighter than the class's own `gap-6`.
		 */
		<section className="form-section gap-4 rounded-2xl border border-border bg-surface p-6">
			<h2 className="text-lg font-semibold">{title}</h2>
			{children}
		</section>
	);
}

function CheckoutSuccess({
	order,
	translations,
}: {
	readonly order: CartCheckoutModel;
	readonly translations: CheckoutTranslations;
}) {
	return (
		<div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
			<h2 className="text-xl font-semibold">
				{translations['checkout.success.title']}
			</h2>
			<p>
				{translations['checkout.success.reference']}{' '}
				<span className="font-semibold tabular-nums">
					{order.ref_code}-{order.ref_number}
				</span>
			</p>
			<p className="text-sm text-muted">
				{translations['checkout.success.body']}
			</p>
			<NextLink href={Routes.get('products')} className={linkClassName}>
				{translations['checkout.continue_shopping']}
			</NextLink>
		</div>
	);
}

/**
 * The checkout page: delivery, billing, payment, then one request that turns the cart into a
 * pending order.
 *
 * **`useMutation` rather than the `processForm` pipeline.** The page is three independent choices
 * plus a billing editor that is itself a create-or-update against a different endpoint, and "Place
 * order" may have to run both writes in sequence. `processForm` validates one `FormData` against one
 * operation, so this would be two action hosts and a hand-off between them for what is two awaited
 * calls. The checks here are a courtesy; the backend validates both writes again.
 *
 * **The first billing entry is not written until it is needed.** An account with no clients gets
 * the editor prefilled from the account (name, email) and nothing is created until "Save" or
 * "Place order" - so a shopper who opens checkout and leaves does not leave a client behind.
 */
export function CheckoutForm(): JSX.Element {
	const { translations } = useTranslation(CHECKOUT_TRANSLATION_KEYS);
	const { showToast } = useToast();
	const { auth } = useAuth();
	const queryClient = useQueryClient();
	const { cart, lines, isLoading: isCartLoading } = useCart();

	const elementIds = useElementIds([
		'delivery_method',
		'payment_method',
		'notes',
	] as const);

	const clientsQuery = useQuery({
		queryKey: OWN_CLIENTS_QUERY_KEY,
		queryFn: async () =>
			getResponseData(await requestOwnClients())?.entries ?? [],
		// The account's own rows, changed from this page - a cached list would hide a save.
		staleTime: 0,
	});

	const clients = clientsQuery.data;

	const [values, setValues] = useState<CheckoutValues>(
		CHECKOUT_INITIAL_VALUES,
	);
	const [selectedClientId, setSelectedClientId] = useState<number | null>(
		null,
	);
	const [editor, setEditor] = useState<BillingEditor | null>(null);
	const [billingValues, setBillingValues] = useState<BillingValues>(() =>
		getDefaultBillingValues(auth),
	);
	const [showErrors, setShowErrors] = useState(false);
	const [showBillingErrors, setShowBillingErrors] = useState(false);
	const [placedOrder, setPlacedOrder] = useState<CartCheckoutModel | null>(
		null,
	);

	/*
	 * Once, when the list first arrives: the newest entry is preselected, or the editor opens for an
	 * account with none. Not re-run on refetch - that would reopen an editor the shopper just
	 * saved, or move a selection they made.
	 */
	const isBillingInitialized = useRef(false);

	useEffect(() => {
		if (!clients || isBillingInitialized.current) {
			return;
		}

		isBillingInitialized.current = true;

		const newest = clients[0];

		if (newest) {
			setSelectedClientId(newest.id);

			return;
		}

		setBillingValues(getDefaultBillingValues(auth));
		setEditor({ mode: 'create' });
	}, [clients, auth]);

	const checkoutErrors = validateCheckout(values);
	const billingErrors = validateBilling(billingValues);

	/*
	 * The client whose addresses are offered. Null while a new billing entry is still an open form:
	 * addresses are filed under a client, and that one does not exist until it is saved.
	 */
	const addressClientId = editor?.mode === 'create' ? null : selectedClientId;

	// Stable, and a no-op when unchanged: `CheckoutAddresses` calls these from an effect
	const selectBillingAddress = useCallback(
		(addressId: number | null) =>
			setValues((current) =>
				current.billing_address_id === addressId
					? current
					: { ...current, billing_address_id: addressId },
			),
		[],
	);

	const selectDeliveryAddress = useCallback(
		(addressId: number | null) =>
			setValues((current) =>
				current.delivery_address_id === addressId
					? current
					: { ...current, delivery_address_id: addressId },
			),
		[],
	);

	/**
	 * Writes the open editor and makes the result the selected entry. Shared by "Save" and by
	 * "Place order", which is why it throws rather than toasting - each caller reports in its own
	 * words.
	 */
	const saveBilling = useCallback(async (): Promise<ClientModel> => {
		const params = getBillingParams(billingValues);

		const response =
			editor?.mode === 'edit'
				? await requestUpdateOwnClient(editor.clientId, params)
				: await requestCreateOwnClient(params);

		const saved = getResponseData(response);

		if (!saved) {
			throw new Error(translations['checkout.billing.save_failed']);
		}

		setSelectedClientId(saved.id);
		setEditor(null);
		setShowBillingErrors(false);

		await queryClient.invalidateQueries({
			queryKey: OWN_CLIENTS_QUERY_KEY,
		});

		return saved;
	}, [billingValues, editor, queryClient, translations]);

	const saveMutation = useMutation({
		mutationFn: saveBilling,
		onSuccess: () =>
			showToast({
				severity: 'success',
				summary: translations['checkout.billing.saved'],
			}),
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['checkout.billing.save_failed'],
				// The backend's wording: a 409 names the company already on file
				detail: getErrorMessage(error),
			}),
	});

	const placeMutation = useMutation({
		mutationFn: async (): Promise<CartCheckoutModel> => {
			const clientId = editor
				? (await saveBilling()).id
				: selectedClientId;

			if (
				!clientId ||
				values.billing_address_id === null ||
				!values.delivery_method ||
				!values.payment_method
			) {
				throw new Error(translations['checkout.validation.billing']);
			}

			const result = getResponseData(
				await requestCartCheckout({
					client_id: clientId,
					billing_address_id: values.billing_address_id,
					delivery_method: values.delivery_method,
					delivery_address_id:
						values.delivery_method === ShippingMethodEnum.COURIER
							? values.delivery_address_id
							: null,
					payment_method: values.payment_method,
					notes: values.notes.trim() || null,
				}),
			);

			if (!result) {
				throw new Error(translations['checkout.place_failed']);
			}

			return result;
		},
		onSuccess: (result) => {
			setPlacedOrder(result);

			/*
			 * The cart was deleted with the order, so the cached basket is stale: re-reading it
			 * creates the fresh empty one and resets the header badge. The success panel is
			 * rendered ahead of the empty-cart branch, so that re-read cannot replace it.
			 */
			void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['checkout.place_failed'],
				detail: getErrorMessage(error),
			}),
	});

	const isBusy = saveMutation.isPending || placeMutation.isPending;

	const setValue = <K extends keyof CheckoutValues>(
		field: K,
		value: CheckoutValues[K],
	) => setValues((current) => ({ ...current, [field]: value }));

	const fieldError = (field: keyof CheckoutValues): string[] | undefined => {
		const key = checkoutErrors[field];

		return showErrors && key ? [translations[key]] : undefined;
	};

	const onSaveBilling = () => {
		setShowBillingErrors(true);

		if (!hasErrors(billingErrors)) {
			saveMutation.mutate();
		}
	};

	const onSubmit = (event: React.SubmitEvent) => {
		event.preventDefault();

		setShowErrors(true);
		setShowBillingErrors(true);

		const isBillingValid = editor
			? !hasErrors(billingErrors)
			: selectedClientId !== null;

		if (hasErrors(checkoutErrors) || !isBillingValid || isBusy) {
			return;
		}

		placeMutation.mutate();
	};

	if (placedOrder) {
		return (
			<CheckoutSuccess order={placedOrder} translations={translations} />
		);
	}

	if (isCartLoading || clientsQuery.isLoading) {
		return <p className="text-muted">{translations['checkout.loading']}</p>;
	}

	if (!cart || lines.length === 0) {
		return (
			<div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
				<p className="text-muted">{translations['checkout.empty']}</p>
				<NextLink
					href={Routes.get('products')}
					className={linkClassName}
				>
					{translations['checkout.continue_shopping']}
				</NextLink>
			</div>
		);
	}

	const pricing = cart.pricing;
	const componentsByParent = groupCartComponents(lines);

	// The same arithmetic as the basket summary, so the two pages state the same figures
	const discountGross = getCartDiscountGross(pricing.lines);
	const productsCost = roundMoney(
		pricing.total + discountGross - DELIVERY_COST,
	);

	// The backend refuses a cart with issues, and the basket is where they are resolved
	if (pricing.has_issues) {
		return (
			<div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
				<p className="font-medium text-danger">
					{translations['checkout.has_issues']}
				</p>
				<NextLink
					href={Routes.get('cart-view')}
					className={linkClassName}
				>
					{translations['checkout.back_to_cart']}
				</NextLink>
			</div>
		);
	}

	return (
		<form
			onSubmit={onSubmit}
			noValidate
			className="grid gap-8 lg:grid-cols-[1fr_320px]"
		>
			<div className="space-y-6">
				<Section title={translations['checkout.delivery.title']}>
					<FormComponentRadio<CheckoutValues>
						id={elementIds.delivery_method}
						labelText={translations['checkout.delivery.method']}
						fieldName="delivery_method"
						fieldValue={values.delivery_method}
						isRequired={true}
						disabled={isBusy}
						options={DELIVERY_METHOD_OPTIONS.map((option) => ({
							value: option.value,
							label: translations[option.labelKey],
						}))}
						onChange={(value) =>
							setValue('delivery_method', toShippingMethod(value))
						}
						error={fieldError('delivery_method')}
					/>

					{values.delivery_method ===
						ShippingMethodEnum.SELF_PICKUP && (
						<p className="text-sm text-muted">
							{translations['checkout.delivery.self_pickup_hint']}
						</p>
					)}

					{values.delivery_method === ShippingMethodEnum.COURIER && (
						<CheckoutAddresses
							clientId={addressClientId}
							type={ClientAddressTypeEnum.DELIVERY}
							title={
								translations['checkout.address.delivery_title']
							}
							selectedId={values.delivery_address_id}
							isMissingSelection={
								showErrors &&
								!!checkoutErrors.delivery_address_id
							}
							missingMessageKey="checkout.validation.delivery_address"
							translations={translations}
							disabled={isBusy}
							onSelect={selectDeliveryAddress}
						/>
					)}
				</Section>

				<Section title={translations['checkout.billing.title']}>
					<CheckoutBilling
						clients={clients ?? []}
						selectedClientId={selectedClientId}
						editor={editor}
						values={billingValues}
						errors={billingErrors}
						showErrors={showBillingErrors}
						isMissingSelection={
							showErrors && !editor && selectedClientId === null
						}
						translations={translations}
						disabled={isBusy}
						onSelect={(clientId) => {
							setSelectedClientId(clientId);
							setEditor(null);
						}}
						onChange={(field, value) =>
							setBillingValues((current) => ({
								...current,
								[field]: value,
							}))
						}
						onCreate={() => {
							setBillingValues(getDefaultBillingValues(auth));
							setShowBillingErrors(false);
							setEditor({ mode: 'create' });
						}}
						onEdit={(client) => {
							setBillingValues(
								getBillingValuesFromClient(client),
							);
							setShowBillingErrors(false);
							setSelectedClientId(client.id);
							setEditor({ mode: 'edit', clientId: client.id });
						}}
						onCancel={() => setEditor(null)}
						onSave={onSaveBilling}
					/>

					<CheckoutAddresses
						clientId={addressClientId}
						type={ClientAddressTypeEnum.BILLING}
						title={translations['checkout.address.billing_title']}
						selectedId={values.billing_address_id}
						isMissingSelection={
							showErrors && !!checkoutErrors.billing_address_id
						}
						missingMessageKey="checkout.validation.billing_address"
						translations={translations}
						disabled={isBusy}
						onSelect={selectBillingAddress}
					/>
				</Section>

				<Section title={translations['checkout.payment.title']}>
					<FormComponentRadio<CheckoutValues>
						id={elementIds.payment_method}
						labelText={translations['checkout.payment.method']}
						fieldName="payment_method"
						fieldValue={values.payment_method}
						isRequired={true}
						disabled={isBusy}
						options={PAYMENT_METHOD_OPTIONS.map((option) => ({
							value: option.value,
							label: translations[option.labelKey],
						}))}
						onChange={(value) =>
							setValue('payment_method', toPaymentMethod(value))
						}
						error={fieldError('payment_method')}
					/>

					<FormComponentTextarea<CheckoutValues>
						id={elementIds.notes}
						labelText={translations['checkout.notes.label']}
						placeholderText={
							translations['checkout.notes.placeholder']
						}
						fieldName="notes"
						fieldValue={values.notes}
						rows={3}
						disabled={isBusy}
						onChange={(event) =>
							setValue('notes', event.target.value)
						}
						error={fieldError('notes')}
					/>
				</Section>
			</div>

			<aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24">
				<div className="flex items-baseline justify-between gap-3">
					<h2 className="font-semibold">
						{translations['checkout.summary.title']}
					</h2>

					<NextLink
						href={Routes.get('cart-view')}
						className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
					>
						{translations['checkout.summary.edit_cart']}
					</NextLink>
				</div>

				{/*
				 * What is being bought, read-only - quantities and removals stay on the cart page,
				 * where a changed line reprices in place. Uncapped: the card grows with the basket
				 * rather than scrolling inside itself.
				 */}
				<ul className="mt-4 divide-y divide-border border-b border-border text-sm">
					{lines
						.filter((line) => line.parent_id === null)
						.map((line) => {
							const components =
								componentsByParent.get(line.id) ?? [];
							const lineTotal = getCartLineGrossTotal(
								line,
								components,
							);
							const unitPrice = getCartLineGrossUnitPrice(
								line,
								lineTotal,
							);

							return (
								<li
									key={line.id}
									className="flex items-start justify-between gap-3 py-2 first:pt-0"
								>
									<div className="min-w-0">
										<p className="truncate">
											{displayCartLineName(line)}
										</p>

										<p className="text-xs text-muted tabular-nums">
											{line.quantity} ×{' '}
											{money(unitPrice, pricing.currency)}
											{line.discount && (
												<span className="ml-2 text-accent">
													{line.discount.label}
												</span>
											)}
										</p>

										{components.length > 0 && (
											<ul className="text-xs text-muted">
												{components.map((component) => (
													<li key={component.id}>
														{component.quantity !==
															1 &&
															`${component.quantity} × `}
														{displayCartLineName(
															component,
														)}
													</li>
												))}
											</ul>
										)}
									</div>

									<span className="shrink-0 tabular-nums">
										{money(lineTotal, pricing.currency)}
									</span>
								</li>
							);
						})}
				</ul>

				<dl className="mt-4 space-y-2 text-sm">
					<div className="flex justify-between text-muted">
						<dt>
							{translations['checkout.summary.products_cost']}
						</dt>
						<dd className="tabular-nums">
							{money(productsCost, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between text-muted">
						<dt>{translations['checkout.summary.discount']}</dt>
						<dd className="tabular-nums">
							{discountGross > 0 ? '-' : ''}
							{money(discountGross, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between text-muted">
						<dt>
							{translations['checkout.summary.delivery_cost']}
						</dt>
						<dd className="tabular-nums">
							{money(DELIVERY_COST, pricing.currency)}
						</dd>
					</div>

					<div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
						<dt>{translations['checkout.summary.total']}</dt>
						<dd className="tabular-nums">
							{money(pricing.total, pricing.currency)}
						</dd>
					</div>

					<p className="text-right text-xs text-muted">
						{translations['checkout.summary.vat_included']}{' '}
						{money(pricing.vat_amount, pricing.currency)}
					</p>
				</dl>

				<Button
					type="submit"
					className="mt-5 w-full"
					disabled={isBusy}
					aria-busy={placeMutation.isPending}
				>
					{placeMutation.isPending
						? translations['checkout.placing']
						: translations['checkout.place_order']}
				</Button>
			</aside>
		</form>
	);
}
