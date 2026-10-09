'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import NextLink from 'next/link';
import type React from 'react';
import type { JSX } from 'react';
import {
	Breadcrumb,
	type BreadcrumbItem,
} from '@/app/(public)/_components/breadcrumb.component';
import { CancelOrderButton } from '@/app/(public)/account/orders/cancel-order-button.component';
import Routes from '@/config/routes.setup';
import { getLanguageClient } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { getResponseData } from '@/helpers/api.helper';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { CashFlowDirectionEnum } from '@/models/cash-flow.model';
import {
	InvoicePaymentStatusEnum,
	InvoiceScopeEnum,
} from '@/models/invoice.model';
import {
	displayOrderClient,
	displayOrderMoney,
	displayOrderReference,
	getOrderDiscountGross,
	getOrderLineGrossTotal,
	getOrderLineGrossUnitPrice,
	groupOrderComponents,
	type OrderLineModel,
	OrderStatusEnum,
} from '@/models/order.model';
import { roundMoney } from '@/models/product.model';
import {
	displayAddressSnapshot,
	getDeliveryGrossTotal,
	type OrderShipmentModel,
	ShippingMethodEnum,
	ShippingScopeEnum,
	ShippingStatusEnum,
} from '@/models/shipping.model';
import {
	OWN_ORDERS_QUERY_KEY,
	type OwnOrderInvoice,
	type OwnOrderPayment,
	requestOwnOrder,
	requestOwnOrderBilling,
	requestOwnOrderShipments,
} from '@/services/order.service';

const TRANSLATION_KEYS = [
	'order.storefront.loading',
	'order.storefront.error',
	'order.storefront.not_found',
	'order.storefront.back',
	'order.storefront.placed_on',
	'order.storefront.billed_to',
	'order.storefront.billing',
	'order.storefront.payment_method',
	'order.storefront.items',
	'order.storefront.quantity',
	'order.storefront.unit_price',
	'order.storefront.line_total',
	'order.storefront.summary',
	'order.storefront.products_cost',
	'order.storefront.discount',
	'order.storefront.total',
	'order.storefront.vat_included',
	'order.storefront.notes',
	'order.storefront.jump_to',
	'order.storefront.shipments',
	'order.storefront.shipments_empty',
	'order.storefront.shipment_method',
	'order.storefront.carrier',
	'order.storefront.tracking',
	'order.storefront.track',
	'order.storefront.pickup_from',
	'order.storefront.deliver_to',
	'order.storefront.shipped_at',
	'order.storefront.delivered_at',
	'order.storefront.updated_at',
	'order.storefront.estimated_delivery_at',
	'order.storefront.scope_return',
	'order.storefront.delivery_cost',
	'order.storefront.delivery_free',
	'order.storefront.delivery_canceled',
	'checkout.delivery.self_pickup',
	'checkout.delivery.courier',
	'checkout.payment.cash_on_delivery',
	'checkout.payment.card',
	'checkout.payment.bank_transfer',
	'checkout.billing.company_cui',
	'checkout.billing.company_reg_com',
	'checkout.billing.contact_email',
	'checkout.billing.contact_phone',
	'checkout.address.billing_title',
	'order.storefront.invoices_payments',
	'order.storefront.invoices',
	'order.storefront.payments',
	'order.storefront.invoices_empty',
	'order.storefront.payments_empty',
	'order.storefront.invoice_scope_order',
	'order.storefront.invoice_scope_shipping',
	'order.storefront.invoice_reversal',
	'order.storefront.invoice_view',
	'order.storefront.issued_on',
	'order.storefront.due_on',
	'order.storefront.refund',
	'order.storefront.payment_methods.credit_card',
	'order.storefront.payment_methods.debit_card',
	'order.storefront.payment_methods.paypal',
	'order.storefront.payment_methods.cash',
	'order.storefront.payment_methods.bank_transfer',
	'order.storefront.payment_methods.check',
	'order.storefront.payment_methods.crypto',
	'order.storefront.payment_methods.gift_card',
] as const;

type Translations = Record<(typeof TRANSLATION_KEYS)[number], string>;

/** The issue date as the listing states it - see `DATE_FORMAT` there. */
const DATE_FORMAT = 'D MMMM YYYY, HH:mm';

/**
 * The same date without a time, for the delivery estimate alone. The backend takes that one as a
 * day (`requireTime: false` on its validator), so its stored time is midnight and printing it
 * would state an hour nobody promised.
 */
const DATE_ONLY_FORMAT = 'D MMMM YYYY';

/**
 * The page's sections, in the order they render - each one a shortcut under the header box.
 * `scroll-mt-24` on every target clears the sticky site header a jump would otherwise land under.
 */
const SECTION_IDS = {
	items: 'order-items',
	delivery: 'order-delivery',
	billing: 'order-billing',
	invoices: 'order-invoices',
	summary: 'order-summary',
} as const;

function Card({
	id,
	title,
	children,
}: {
	readonly id: string;
	readonly title: string;
	readonly children: React.ReactNode;
}) {
	return (
		<section
			id={id}
			className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-surface p-6"
		>
			<h2 className="text-lg font-semibold">{title}</h2>
			{children}
		</section>
	);
}

function Detail({
	label,
	children,
}: {
	readonly label: string;
	readonly children: React.ReactNode;
}) {
	return (
		<div>
			<dt className="text-sm text-muted">{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}

/** How a line is named: its product, else its SKU - a bundle component names another product. */
function displayLineName(line: OrderLineModel): string {
	return line.label ?? line.variant?.sku ?? `#${line.variant_id}`;
}

function ShipmentCard({
	shipment,
	translations,
}: {
	readonly shipment: OrderShipmentModel;
	readonly translations: Translations;
}) {
	const isPickup = shipment.method === ShippingMethodEnum.SELF_PICKUP;
	const language = getLanguageClient();

	return (
		<li className="space-y-3 py-4 first:pt-0 last:pb-0">
			<div className="flex flex-wrap items-center gap-3">
				{shipment.scope === ShippingScopeEnum.RETURN && (
					<span className="font-medium">
						{translations['order.storefront.scope_return']}
					</span>
				)}
				<DisplayStatus status={shipment.status} dataSource="shipping" />
			</div>

			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				<Detail
					label={translations['order.storefront.shipment_method']}
				>
					{isPickup
						? translations['checkout.delivery.self_pickup']
						: translations['checkout.delivery.courier']}
				</Detail>

				{shipment.carrier && (
					<Detail label={translations['order.storefront.carrier']}>
						{shipment.carrier.name}
					</Detail>
				)}

				{isPickup && shipment.pickup_warehouse && (
					<Detail
						label={translations['order.storefront.pickup_from']}
					>
						{shipment.pickup_warehouse.name}
					</Detail>
				)}

				{/* Frozen only once the movement ships - before that there is no settled address */}
				{shipment.destination_data && !isPickup && (
					<Detail label={translations['order.storefront.deliver_to']}>
						{displayAddressSnapshot(shipment.destination_data)}
					</Detail>
				)}

				{shipment.tracking_number && (
					<Detail label={translations['order.storefront.tracking']}>
						<span className="tabular-nums">
							{shipment.tracking_number}
						</span>
						{shipment.tracking_url && (
							<>
								{' · '}
								<a
									href={shipment.tracking_url}
									target="_blank"
									rel="noopener noreferrer"
									className="underline underline-offset-4 hover:text-accent"
								>
									{translations['order.storefront.track']}
								</a>
							</>
						)}
					</Detail>
				)}

				{shipment.shipped_at && (
					<Detail label={translations['order.storefront.shipped_at']}>
						{formatDate(shipment.shipped_at, undefined, {
							customFormat: DATE_FORMAT,
							language: language,
						})}
					</Detail>
				)}

				{shipment.delivered_at ? (
					<Detail
						label={translations['order.storefront.delivered_at']}
					>
						{formatDate(shipment.delivered_at, undefined, {
							customFormat: DATE_FORMAT,
							language: language,
						})}
					</Detail>
				) : (
					shipment.estimated_delivery_at && (
						<Detail
							label={
								translations[
									'order.storefront.estimated_delivery_at'
								]
							}
						>
							{formatDate(
								shipment.estimated_delivery_at,
								undefined,
								{
									customFormat: DATE_ONLY_FORMAT,
									language: language,
								},
							)}
						</Detail>
					)
				)}

				{/* `updated_at` is null on a movement never edited since it was created */}
				<Detail label={translations['order.storefront.updated_at']}>
					{formatDate(
						shipment.updated_at ?? shipment.created_at,
						undefined,
						{
							customFormat: DATE_FORMAT,
							language: language,
						},
					)}
				</Detail>
			</dl>
		</li>
	);
}

/**
 * What a document bills, as its buyer reads it: the goods or a delivery fee, and a credit note for
 * either when it is a reversal. A subscription or custom document is never raised for an order, so
 * the scope alone is enough.
 */
function displayInvoiceKind(
	invoice: OwnOrderInvoice,
	translations: Translations,
): string {
	if (invoice.is_reversal) {
		return translations['order.storefront.invoice_reversal'];
	}

	return invoice.scope === InvoiceScopeEnum.SHIPPING
		? translations['order.storefront.invoice_scope_shipping']
		: translations['order.storefront.invoice_scope_order'];
}

function InvoiceRow({
	orderId,
	invoice,
	translations,
}: {
	readonly orderId: number;
	readonly invoice: OwnOrderInvoice;
	readonly translations: Translations;
}) {
	const language = getLanguageClient();
	const format = (date: string) =>
		formatDate(date, undefined, {
			customFormat: DATE_ONLY_FORMAT,
			language: language,
		}) ?? '';
	// Only an original is settled; a credit note is money handed back, with no balance of its own
	const isOpen =
		!invoice.is_reversal &&
		invoice.payment_status !== InvoicePaymentStatusEnum.PAID;

	return (
		<li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
			<div className="min-w-0 space-y-2">
				<p>
					<span className="font-medium tabular-nums">
						{invoice.ref_code}-{invoice.ref_number}
					</span>
					<span className="text-muted">
						{' · '}
						{displayInvoiceKind(invoice, translations)}
					</span>
				</p>
				<p className="text-xs text-muted">
					{invoice.issued_at &&
						replaceVars(
							translations['order.storefront.issued_on'],
							{
								date: format(invoice.issued_at),
							},
						)}
					{isOpen && invoice.due_at && (
						<>
							{' · '}
							{replaceVars(
								translations['order.storefront.due_on'],
								{
									date: format(invoice.due_at),
								},
							)}
						</>
					)}
				</p>
				{/* A new tab: the printable copy is a page of its own, outside the site layout */}
				<NextLink
					href={Routes.get('account-order-invoice', {
						order_id: orderId,
						id: invoice.id,
					})}
					target="_blank"
					className="flex w-fit items-center gap-1 text-xs underline underline-offset-4 hover:text-accent"
				>
					<FileText aria-hidden="true" className="size-3.5" />
					{translations['order.storefront.invoice_view']}
				</NextLink>
			</div>

			<div className="flex shrink-0 flex-col items-end gap-1">
				<span className="tabular-nums">
					{invoice.is_reversal && '-'}
					{displayOrderMoney(invoice.total_gross, invoice.currency)}
				</span>
				{!invoice.is_reversal && (
					<DisplayStatus
						status={invoice.payment_status}
						dataSource="invoice"
					/>
				)}
			</div>
		</li>
	);
}

/**
 * One payment on a line: how it is made and what it asks for, VAT included, with where it stands
 * beside it.
 * A payment has no due date of its own - the one the buyer is held to is the invoice's, on the
 * invoice row.
 */
function PaymentRow({
	payment,
	translations,
}: {
	readonly payment: OwnOrderPayment;
	readonly translations: Translations;
}) {
	const isRefund = payment.direction === CashFlowDirectionEnum.OUT;

	return (
		<li className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0">
			<div>
				<p>
					<span className="font-medium">
						{
							translations[
								`order.storefront.payment_methods.${payment.method}`
							]
						}
					</span>
					{isRefund && (
						<span className="text-muted">
							{' · '}
							{translations['order.storefront.refund']}
						</span>
					)}
				</p>
				<p className="tabular-nums">
					{isRefund && '-'}
					{displayOrderMoney(payment.gross_amount, payment.currency)}
				</p>
			</div>

			<DisplayStatus status={payment.status} dataSource="cash-flow" />
		</li>
	);
}

export function AccountOrderView({
	id,
	trail,
}: {
	readonly id: number;
	/** The crumbs above this page, translated by the server page that renders it. */
	readonly trail: readonly BreadcrumbItem[];
}): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const isValidId = Number.isInteger(id) && id > 0;

	const orderQuery = useQuery({
		queryKey: [...OWN_ORDERS_QUERY_KEY, 'view', id],
		queryFn: async () => {
			const data = getResponseData(await requestOwnOrder(id));

			if (!data) {
				throw new Error('Could not retrieve own order');
			}

			return data;
		},
		enabled: isValidId,
		// A 404 is the answer, not a transient failure worth a second request
		retry: (failureCount, error) =>
			!(error instanceof ApiError && error.status === 404) &&
			failureCount < 1,
	});

	const shipmentsQuery = useQuery({
		queryKey: [...OWN_ORDERS_QUERY_KEY, 'shipments', id],
		queryFn: async () =>
			getResponseData(await requestOwnOrderShipments(id))?.entries ?? [],
		// Behind the order read: a foreign id would only fetch the same 404 a second time
		enabled: orderQuery.isSuccess,
	});

	const billingQuery = useQuery({
		queryKey: [...OWN_ORDERS_QUERY_KEY, 'billing', id],
		queryFn: async () =>
			getResponseData(await requestOwnOrderBilling(id)) ?? {
				invoices: [],
				payments: [],
			},
		// Behind the order read, for the reason the shipments are
		enabled: orderQuery.isSuccess,
	});

	/*
	 * The trail, closed with the order's reference - the page above cannot state that one, since
	 * the order is read here. A read that has not landed (or never will, for an id that is
	 * malformed or somebody else's) falls back to the id the URL carries.
	 */
	const renderPage = (children: React.ReactNode) => (
		<>
			<Breadcrumb
				items={[
					...trail,
					{
						label: orderQuery.data
							? displayOrderReference(orderQuery.data)
							: `#${isValidId ? id : ''}`,
					},
				]}
			/>

			<div className="mt-8">{children}</div>
		</>
	);

	const backLink = (
		<NextLink
			href={Routes.get('account-orders')}
			className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
		>
			← {translations['order.storefront.back']}
		</NextLink>
	);

	const renderMessage = (message: string, className = '') =>
		renderPage(
			<div className="space-y-4">
				<p className={className}>{message}</p>
				{backLink}
			</div>,
		);

	// The query is disabled for a malformed id, and a disabled query stays pending forever
	if (!isValidId) {
		return renderMessage(translations['order.storefront.not_found']);
	}

	if (orderQuery.isPending) {
		return renderPage(
			<p className="text-muted">
				{translations['order.storefront.loading']}
			</p>,
		);
	}

	if (orderQuery.isError) {
		return orderQuery.error instanceof ApiError &&
			orderQuery.error.status === 404
			? renderMessage(translations['order.storefront.not_found'])
			: renderMessage(
					translations['order.storefront.error'],
					'text-danger',
				);
	}

	const order = orderQuery.data;
	const { lines, totals } = order;
	const componentsByParent = groupOrderComponents(lines);
	const discountGross = getOrderDiscountGross(lines);
	const productsCost = roundMoney(totals.total + discountGross);
	const shipments = shipmentsQuery.data ?? [];

	/*
	 * The order's own totals are the goods; what delivery cost lives on its shipments. Null until
	 * the shipments arrive, so the total is not shown without it.
	 */
	const delivery = shipmentsQuery.isSuccess
		? getDeliveryGrossTotal(shipments)
		: null;
	/*
	 * Every delivery withdrawn with a canceled order: it charges nothing, but "free" would say it
	 * was given away rather than called off.
	 */
	const deliveries = shipments.filter(
		(shipment) => shipment.scope === ShippingScopeEnum.DELIVERY,
	);
	const isDeliveryCanceled =
		deliveries.length > 0 &&
		deliveries.every(
			(shipment) => shipment.status === ShippingStatusEnum.CANCELED,
		);
	const orderTotal = roundMoney(totals.total + (delivery?.total ?? 0));
	const orderVat = roundMoney(
		totals.vat_amount + (delivery?.vat_amount ?? 0),
	);

	return renderPage(
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-4">
				<h1 className="text-2xl font-semibold tabular-nums md:text-3xl">
					{displayOrderReference(order)}
				</h1>
				<DisplayStatus
					status={
						order.awaiting_payment
							? 'awaiting_payment'
							: order.status
					}
					dataSource="order"
				/>
				{order.status === OrderStatusEnum.PENDING && (
					<div className="ml-auto">
						<CancelOrderButton orderId={order.id} />
					</div>
				)}
			</div>

			<div className="space-y-5 rounded-2xl border border-border bg-surface p-6 text-sm">
				<dl className="grid gap-4 sm:grid-cols-2">
					<Detail label={translations['order.storefront.placed_on']}>
						{formatDate(order.created_at, undefined, {
							customFormat: DATE_FORMAT,
							language: getLanguageClient(),
						})}
					</Detail>
					{order.payment_method && (
						<Detail
							label={
								translations['order.storefront.payment_method']
							}
						>
							{
								translations[
									`checkout.payment.${order.payment_method}`
								]
							}
						</Detail>
					)}
					{order.notes && (
						<div className="sm:col-span-2">
							<Detail
								label={translations['order.storefront.notes']}
							>
								<span className="whitespace-pre-line">
									{order.notes}
								</span>
							</Detail>
						</div>
					)}
				</dl>

				{/* Anchors rather than tabs: every section stays on the page, these only jump to it */}
				<nav
					aria-label={translations['order.storefront.jump_to']}
					className="flex flex-wrap gap-2 border-t border-border pt-4"
				>
					{(
						[
							[SECTION_IDS.items, 'order.storefront.items'],
							[
								SECTION_IDS.delivery,
								'order.storefront.shipments',
							],
							[SECTION_IDS.billing, 'order.storefront.billing'],
							[
								SECTION_IDS.invoices,
								'order.storefront.invoices_payments',
							],
							[SECTION_IDS.summary, 'order.storefront.summary'],
						] as const
					).map(([target, key]) => (
						<a
							key={target}
							href={`#${target}`}
							className="rounded-full border border-border px-3 py-1 transition-colors hover:border-accent hover:text-accent"
						>
							{translations[key]}
						</a>
					))}
				</nav>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
				<div className="space-y-6">
					<Card
						id={SECTION_IDS.items}
						title={translations['order.storefront.items']}
					>
						<ul className="divide-y divide-border text-sm">
							{lines
								.filter((line) => line.parent_id === null)
								.map((line) => {
									const components =
										componentsByParent.get(line.id) ?? [];
									const lineTotal = getOrderLineGrossTotal(
										line,
										components,
									);
									const unitPrice =
										getOrderLineGrossUnitPrice(
											line,
											components,
											lineTotal,
										);

									return (
										<li
											key={line.id}
											className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
										>
											<div className="min-w-0">
												<p className="font-medium">
													{displayLineName(line)}
												</p>

												<p className="text-xs text-muted tabular-nums">
													{line.quantity} ×{' '}
													{displayOrderMoney(
														unitPrice,
														totals.currency,
													)}
													{line.discount?.map(
														(discount, index) => (
															<span
																key={
																	discount.discount_id ??
																	index
																}
																className="ml-2 text-accent"
															>
																{discount.label}
															</span>
														),
													)}
												</p>

												{line.options &&
													line.options.length > 0 && (
														<p className="text-xs text-muted">
															{line.options
																.map(
																	(option) =>
																		option.label,
																)
																.join(', ')}
														</p>
													)}

												{components.length > 0 && (
													<ul className="text-xs text-muted">
														{components.map(
															(component) => (
																<li
																	key={
																		component.id
																	}
																>
																	{component.quantity !==
																		1 &&
																		`${component.quantity} × `}
																	{displayLineName(
																		component,
																	)}
																</li>
															),
														)}
													</ul>
												)}
											</div>

											<span className="shrink-0 tabular-nums">
												{displayOrderMoney(
													lineTotal,
													totals.currency,
												)}
											</span>
										</li>
									);
								})}
						</ul>
					</Card>

					<Card
						id={SECTION_IDS.delivery}
						title={translations['order.storefront.shipments']}
					>
						{shipmentsQuery.isPending ? (
							<p className="text-sm text-muted">
								{translations['order.storefront.loading']}
							</p>
						) : shipmentsQuery.isError ? (
							<p className="text-sm text-danger">
								{translations['order.storefront.error']}
							</p>
						) : shipments.length === 0 ? (
							<p className="text-sm text-muted">
								{
									translations[
										'order.storefront.shipments_empty'
									]
								}
							</p>
						) : (
							<ul className="divide-y divide-border">
								{shipments.map((shipment) => (
									<ShipmentCard
										key={shipment.id}
										shipment={shipment}
										translations={translations}
									/>
								))}
							</ul>
						)}
					</Card>

					<Card
						id={SECTION_IDS.billing}
						title={translations['order.storefront.billing']}
					>
						<dl className="grid gap-3 text-sm sm:grid-cols-2">
							<Detail
								label={
									translations['order.storefront.billed_to']
								}
							>
								{displayOrderClient(order)}
							</Detail>

							{order.client?.company_cui && (
								<Detail
									label={
										translations[
											'checkout.billing.company_cui'
										]
									}
								>
									<span className="tabular-nums">
										{order.client.company_cui}
									</span>
								</Detail>
							)}

							{order.client?.company_reg_com && (
								<Detail
									label={
										translations[
											'checkout.billing.company_reg_com'
										]
									}
								>
									{order.client.company_reg_com}
								</Detail>
							)}

							{order.client?.contact_email && (
								<Detail
									label={
										translations[
											'checkout.billing.contact_email'
										]
									}
								>
									{order.client.contact_email}
								</Detail>
							)}

							{order.client?.contact_phone && (
								<Detail
									label={
										translations[
											'checkout.billing.contact_phone'
										]
									}
								>
									<span className="tabular-nums">
										{order.client.contact_phone}
									</span>
								</Detail>
							)}

							{/* The address as it was billed - a snapshot, so a later edit to the client's address does not move it */}
							{order.billing_address && (
								<Detail
									label={
										translations[
											'checkout.address.billing_title'
										]
									}
								>
									{displayAddressSnapshot({
										...order.billing_address,
										address_country:
											order.billing_address
												.address_country ?? null,
									})}
								</Detail>
							)}
						</dl>
					</Card>

					<Card
						id={SECTION_IDS.invoices}
						title={
							translations['order.storefront.invoices_payments']
						}
					>
						{billingQuery.isPending ? (
							<p className="text-sm text-muted">
								{translations['order.storefront.loading']}
							</p>
						) : billingQuery.isError ? (
							<p className="text-sm text-danger">
								{translations['order.storefront.error']}
							</p>
						) : (
							<div className="space-y-6 text-sm">
								<div>
									<h3 className="text-xs uppercase tracking-wide text-muted">
										{
											translations[
												'order.storefront.invoices'
											]
										}
									</h3>
									{billingQuery.data.invoices.length === 0 ? (
										<p className="mt-2 text-muted">
											{
												translations[
													'order.storefront.invoices_empty'
												]
											}
										</p>
									) : (
										<ul className="mt-2 divide-y divide-border">
											{billingQuery.data.invoices.map(
												(invoice) => (
													<InvoiceRow
														key={invoice.id}
														orderId={order.id}
														invoice={invoice}
														translations={
															translations
														}
													/>
												),
											)}
										</ul>
									)}
								</div>

								<div>
									<h3 className="text-xs uppercase tracking-wide text-muted">
										{
											translations[
												'order.storefront.payments'
											]
										}
									</h3>
									{billingQuery.data.payments.length === 0 ? (
										<p className="mt-2 text-muted">
											{
												translations[
													'order.storefront.payments_empty'
												]
											}
										</p>
									) : (
										<ul className="mt-2 divide-y divide-border">
											{billingQuery.data.payments.map(
												(payment) => (
													<PaymentRow
														key={payment.id}
														payment={payment}
														translations={
															translations
														}
													/>
												),
											)}
										</ul>
									)}
								</div>
							</div>
						)}
					</Card>
				</div>

				<aside
					id={SECTION_IDS.summary}
					className="h-fit scroll-mt-24 rounded-2xl border border-border bg-surface p-6"
				>
					<h2 className="font-semibold">
						{translations['order.storefront.summary']}
					</h2>

					<dl className="mt-4 space-y-2 text-sm">
						<div className="flex justify-between text-muted">
							<dt>
								{translations['order.storefront.products_cost']}
							</dt>
							<dd className="tabular-nums">
								{displayOrderMoney(
									productsCost,
									totals.currency,
								)}
							</dd>
						</div>

						{discountGross > 0 && (
							<div className="flex justify-between text-muted">
								<dt>
									{translations['order.storefront.discount']}
								</dt>
								<dd className="tabular-nums">
									-
									{displayOrderMoney(
										discountGross,
										totals.currency,
									)}
								</dd>
							</div>
						)}

						<div className="flex justify-between text-muted">
							<dt>
								{translations['order.storefront.delivery_cost']}
							</dt>
							<dd className="tabular-nums">
								{delivery === null
									? '…'
									: isDeliveryCanceled
										? translations[
												'order.storefront.delivery_canceled'
											]
										: delivery.total === 0
											? translations[
													'order.storefront.delivery_free'
												]
											: displayOrderMoney(
													delivery.total,
													totals.currency,
												)}
							</dd>
						</div>

						<div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
							<dt>{translations['order.storefront.total']}</dt>
							<dd className="tabular-nums">
								{displayOrderMoney(orderTotal, totals.currency)}
							</dd>
						</div>

						<p className="text-right text-xs text-muted">
							{translations['order.storefront.vat_included']}{' '}
							{displayOrderMoney(orderVat, totals.currency)}
						</p>
					</dl>
				</aside>
			</div>

			{backLink}
		</div>,
	);
}
