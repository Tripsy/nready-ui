'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';
import { type JSX, useState } from 'react';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { getLanguageClient } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayOrderClient,
	displayOrderMoney,
	displayOrderReference,
	type OrderStatus,
	OrderStatusEnum,
} from '@/models/order.model';
import {
	OWN_ORDERS_QUERY_KEY,
	requestOwnOrders,
} from '@/services/order.service';

/** A buyer holds a handful of orders; ten a page keeps the list scannable without a scroll wall. */
const PAGE_LIMIT = 10;

/**
 * The issue date as a reader says it - "17 September 2026, 20:44". Spelled out rather than taken
 * from a preset because the month is a word here, and which word depends on the reader's language.
 */
const DATE_FORMAT = 'D MMMM YYYY, HH:mm';

const TRANSLATION_KEYS = [
	'order.storefront.loading',
	'order.storefront.error',
	'order.storefront.empty',
	'order.storefront.empty_filtered',
	'order.storefront.start_shopping',
	'order.storefront.filter_all',
	'order.storefront.billed_to',
	'order.storefront.total',
	'order.storefront.view',
	'order.storefront.previous',
	'order.storefront.next',
	'order.storefront.page_of',
	'order.status.pending',
	'order.status.confirmed',
	'order.status.completed',
	'order.status.canceled',
] as const;

const chipClassName =
	'rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer';

export function AccountOrders(): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<OrderStatus | null>(null);

	const listQuery = useQuery({
		queryKey: [...OWN_ORDERS_QUERY_KEY, 'list', page, status],
		queryFn: async () => {
			const data = getResponseData(
				await requestOwnOrders({
					page: page,
					limit: PAGE_LIMIT,
					status: status,
				}),
			);

			if (!data) {
				throw new Error('Could not retrieve own orders');
			}

			return data;
		},
		placeholderData: keepPreviousData,
	});

	const changeStatus = (next: OrderStatus | null) => {
		setStatus(next);
		// A narrower filter may hold fewer pages than the one being left
		setPage(1);
	};

	const entries = listQuery.data?.entries ?? [];
	const total = listQuery.data?.pagination?.total ?? 0;
	const pages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

	const filters: { value: OrderStatus | null; label: string }[] = [
		{ value: null, label: translations['order.storefront.filter_all'] },
		...Object.values(OrderStatusEnum).map((value) => ({
			value: value,
			label: translations[`order.status.${value}`],
		})),
	];

	let body: JSX.Element;

	if (listQuery.isPending) {
		body = (
			<p className="text-muted">
				{translations['order.storefront.loading']}
			</p>
		);
	} else if (listQuery.isError) {
		body = (
			<p className="text-danger">
				{translations['order.storefront.error']}
			</p>
		);
	} else if (entries.length === 0) {
		body = (
			<div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
				<p>
					{status
						? translations['order.storefront.empty_filtered']
						: translations['order.storefront.empty']}
				</p>
				{!status && (
					<NextLink
						href={Routes.get('products')}
						className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
					>
						{translations['order.storefront.start_shopping']}
					</NextLink>
				)}
			</div>
		);
	} else {
		body = (
			<ul
				className="divide-y divide-border rounded-2xl border border-border bg-surface"
				aria-busy={listQuery.isFetching}
			>
				{entries.map((order) => {
					const href = Routes.get('account-order-view', {
						id: order.id,
					});

					return (
						<li
							key={order.id}
							className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 sm:p-6"
						>
							<div className="min-w-40 flex-1">
								<NextLink
									href={href}
									className="font-semibold tabular-nums hover:underline"
								>
									{displayOrderReference(order)}
								</NextLink>
								<p className="text-sm text-muted">
									{formatDate(order.issued_at, undefined, {
										customFormat: DATE_FORMAT,
										language: getLanguageClient(),
									})}
								</p>
							</div>

							<div className="min-w-40 flex-1 text-sm">
								<p className="text-muted">
									{translations['order.storefront.billed_to']}
								</p>
								<p className="truncate">
									{displayOrderClient(order)}
								</p>
							</div>

							<DisplayStatus
								status={order.status}
								dataSource="order"
							/>

							<div className="min-w-28 text-right">
								<p className="text-sm text-muted">
									{translations['order.storefront.total']}
								</p>
								<p className="font-semibold tabular-nums">
									{displayOrderMoney(
										order.totals.total,
										order.totals.currency,
									)}
								</p>
							</div>

							<NextLink
								href={href}
								className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
							>
								{translations['order.storefront.view']}
							</NextLink>
						</li>
					);
				})}
			</ul>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap gap-2">
				{filters.map((filter) => {
					const isActive = filter.value === status;

					return (
						<button
							key={filter.value ?? 'all'}
							type="button"
							aria-pressed={isActive}
							onClick={() => changeStatus(filter.value)}
							className={`${chipClassName} ${
								isActive
									? 'border-accent bg-accent text-accent-foreground'
									: 'border-border hover:border-accent'
							}`}
						>
							{filter.label}
						</button>
					);
				})}
			</div>

			{body}

			{pages > 1 && (
				<div className="flex items-center justify-between gap-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page <= 1 || listQuery.isFetching}
						onClick={() => setPage((current) => current - 1)}
					>
						{translations['order.storefront.previous']}
					</Button>

					<span className="text-sm text-muted tabular-nums">
						{replaceVars(
							translations['order.storefront.page_of'] ?? '',
							{ page: page, pages: pages },
						)}
					</span>

					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={page >= pages || listQuery.isFetching}
						onClick={() => setPage((current) => current + 1)}
					>
						{translations['order.storefront.next']}
					</Button>
				</div>
			)}
		</div>
	);
}
