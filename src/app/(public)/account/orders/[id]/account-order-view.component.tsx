'use client';

import { useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';
import type React from 'react';
import type { JSX } from 'react';
import {
	Breadcrumb,
	type BreadcrumbItem,
} from '@/app/(public)/_components/breadcrumb.component';
import Routes from '@/config/routes.setup';
import { getLanguageClient } from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { getResponseData } from '@/helpers/api.helper';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayOrderClient,
	displayOrderMoney,
	displayOrderReference,
	getOrderDiscountGross,
	getOrderLineGrossTotal,
	getOrderLineGrossUnitPrice,
	groupOrderComponents,
	type OrderLineModel,
} from '@/models/order.model';
import { roundMoney } from '@/models/product.model';
import {
	displayAddressSnapshot,
	getShippingGrossTotal,
	type OrderShipmentModel,
	ShippingMethodEnum,
	ShippingScopeEnum,
} from '@/models/shipping.model';
import {
	OWN_ORDERS_QUERY_KEY,
	requestOwnOrder,
	requestOwnOrderShipments,
} from '@/services/order.service';

const TRANSLATION_KEYS = [
	'order.storefront.loading',
	'order.storefront.error',
	'order.storefront.not_found',
	'order.storefront.back',
	'order.storefront.placed_on',
	'order.storefront.billed_to',
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
	'order.storefront.estimated_delivery_at',
	'order.storefront.scope_return',
	'order.storefront.delivery_cost',
	'order.storefront.delivery_free',
	'checkout.delivery.self_pickup',
	'checkout.delivery.courier',
	'checkout.payment.cash_on_delivery',
	'checkout.payment.card',
	'checkout.payment.bank_transfer',
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

function Card({
	title,
	children,
}: {
	readonly title: string;
	readonly children: React.ReactNode;
}) {
	return (
		<section className="space-y-4 rounded-2xl border border-border bg-surface p-6">
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
			</dl>
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
	 * The order's own totals are the goods; what delivery cost lives on its shipments. Deliveries
	 * only - a return is its own charge, raised later against the order, not part of what was paid
	 * at checkout. Null until the shipments arrive, so the total is not shown without it.
	 */
	const delivery = shipmentsQuery.isSuccess
		? shipments
				.filter(
					(shipment) => shipment.scope === ShippingScopeEnum.DELIVERY,
				)
				.reduce(
					(sum, shipment) => {
						const gross = getShippingGrossTotal(shipment);

						return {
							total: roundMoney(sum.total + gross.total),
							vat_amount: roundMoney(
								sum.vat_amount + gross.vat_amount,
							),
						};
					},
					{ total: 0, vat_amount: 0 },
				)
		: null;
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
				<DisplayStatus status={order.status} dataSource="order" />
			</div>

			<dl className="grid gap-4 rounded-2xl border border-border bg-surface p-6 text-sm sm:grid-cols-3">
				<Detail label={translations['order.storefront.placed_on']}>
					{formatDate(order.issued_at, undefined, {
						customFormat: DATE_FORMAT,
						language: getLanguageClient(),
					})}
				</Detail>
				<Detail label={translations['order.storefront.billed_to']}>
					{displayOrderClient(order)}
				</Detail>
				{order.payment_method && (
					<Detail
						label={translations['order.storefront.payment_method']}
					>
						{
							translations[
								`checkout.payment.${order.payment_method}`
							]
						}
					</Detail>
				)}
			</dl>

			<div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
				<div className="space-y-6">
					<Card title={translations['order.storefront.items']}>
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

					<Card title={translations['order.storefront.shipments']}>
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

					{order.notes && (
						<Card title={translations['order.storefront.notes']}>
							<p className="whitespace-pre-line text-sm">
								{order.notes}
							</p>
						</Card>
					)}
				</div>

				<aside className="h-fit rounded-2xl border border-border bg-surface p-6">
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
