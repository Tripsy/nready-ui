'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { type JSX, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { getLanguageClient } from '@/config/translate.setup';
import { getResponseData } from '@/helpers/api.helper';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus } from '@/helpers/display.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useConfirmationDialog } from '@/hooks/use-confirmation-dialog';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	displayOrderReturnLineLabel,
	displayOrderReturnReference,
	ORDER_RETURN_NOTES_MAX,
	type OrderReturnModel,
	type OrderReturnReason,
	OrderReturnReasonEnum,
	OrderReturnStatusEnum,
} from '@/models/order-return.model';
import { useToast } from '@/providers/toast.provider';
import { OWN_ORDERS_QUERY_KEY } from '@/services/order.service';
import {
	requestCancelOwnOrderReturn,
	requestCreateOwnOrderReturn,
	requestOwnOrderReturnable,
	requestOwnOrderReturns,
} from '@/services/order-return.service';

const TRANSLATION_KEYS = [
	'order-return.storefront.heading',
	'order-return.storefront.empty',
	'order-return.storefront.loading',
	'order-return.storefront.error',
	'order-return.storefront.request',
	'order-return.storefront.request_title',
	'order-return.storefront.request_hint',
	'order-return.storefront.deadline',
	'order-return.storefront.window_closed',
	'order-return.storefront.nothing_returnable',
	'order-return.storefront.reason',
	'order-return.storefront.message',
	'order-return.storefront.message_placeholder',
	'order-return.storefront.quantity_of',
	'order-return.storefront.submit',
	'order-return.storefront.discard',
	'order-return.storefront.pick_items',
	'order-return.storefront.pick_reason',
	'order-return.storefront.request_success',
	'order-return.storefront.request_failed',
	'order-return.storefront.response',
	'order-return.storefront.tracking',
	'order-return.storefront.requested_on',
	'order-return.storefront.cancel',
	'order-return.storefront.cancel_title',
	'order-return.storefront.cancel_confirm',
	'order-return.storefront.cancel_success',
	'order-return.storefront.cancel_failed',
	...enumTranslationKeys('order-return.enum.reason', OrderReturnReasonEnum),
] as const;

type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>;

const DATE_FORMAT = 'D MMM YYYY';

/** The buyer's own requests, under the account-order keys so a cancel of the order drops them too. */
const returnsQueryKey = (orderId: number) =>
	[...OWN_ORDERS_QUERY_KEY, 'returns', orderId] as const;

const returnableQueryKey = (orderId: number) =>
	[...OWN_ORDERS_QUERY_KEY, 'returnable', orderId] as const;

/**
 * Asking to send items back. Inline rather than a page: it belongs to the order, and the buyer
 * picks from what that order delivered. The backend has the last word on every figure - what is
 * still returnable, the window after delivery - and a refusal is shown as it says it.
 */
function ReturnRequestForm({
	orderId,
	translations,
	onDone,
}: {
	readonly orderId: number;
	readonly translations: TranslationsType;
	readonly onDone: () => void;
}): JSX.Element {
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const reasonId = useId();
	const messageId = useId();

	const [reason, setReason] = useState<OrderReturnReason | ''>('');
	const [message, setMessage] = useState('');
	const [quantities, setQuantities] = useState<Record<number, number>>({});
	const [problem, setProblem] = useState<string | null>(null);

	const returnableQuery = useQuery({
		queryKey: returnableQueryKey(orderId),
		queryFn: async () =>
			getResponseData(await requestOwnOrderReturnable(orderId)) ?? {
				deadline: null,
				lines: [],
			},
	});

	const reasons = useMemo(
		() =>
			Object.values(OrderReturnReasonEnum).map((value) => ({
				value: value,
				label: translateEnumLabel(
					translations,
					'order-return.enum.reason',
					value,
				),
			})),
		[translations],
	);

	const { mutate: submit, isPending } = useMutation({
		mutationFn: () =>
			requestCreateOwnOrderReturn(orderId, {
				reason: reason as OrderReturnReason,
				customer_notes: message.trim() || null,
				lines: Object.entries(quantities)
					.filter(([, quantity]) => quantity > 0)
					.map(([variantId, quantity]) => ({
						variant_id: Number(variantId),
						quantity: quantity,
					})),
			}),
		onSuccess: async () => {
			showToast({
				severity: 'success',
				summary:
					translations['order-return.storefront.request_success'],
			});

			await queryClient.invalidateQueries({
				queryKey: [...OWN_ORDERS_QUERY_KEY],
			});

			onDone();
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['order-return.storefront.request_failed'],
				detail: getErrorMessage(error),
			}),
	});

	if (returnableQuery.isPending) {
		return (
			<p className="text-sm text-muted">
				{translations['order-return.storefront.loading']}
			</p>
		);
	}

	const returnable = returnableQuery.data;
	const deadline = returnable?.deadline
		? new Date(returnable.deadline)
		: null;
	const isClosed = deadline !== null && deadline.getTime() < Date.now();

	// Nothing to ask for: say why, and let the buyer put the notice away again
	const notice = (text: string) => (
		<div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
			<p className="flex-1 text-sm text-muted">{text}</p>
			<Button type="button" variant="outline" size="sm" onClick={onDone}>
				{translations['order-return.storefront.discard']}
			</Button>
		</div>
	);

	if (!returnable || returnable.lines.length === 0) {
		return notice(
			translations['order-return.storefront.nothing_returnable'],
		);
	}

	if (isClosed) {
		return notice(translations['order-return.storefront.window_closed']);
	}

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();

		if (!reason) {
			setProblem(translations['order-return.storefront.pick_reason']);

			return;
		}

		if (!Object.values(quantities).some((quantity) => quantity > 0)) {
			setProblem(translations['order-return.storefront.pick_items']);

			return;
		}

		setProblem(null);
		submit();
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-xl border border-border p-4"
		>
			<div>
				<h3 className="font-semibold">
					{translations['order-return.storefront.request_title']}
				</h3>
				<p className="text-sm text-muted">
					{translations['order-return.storefront.request_hint']}
				</p>
				{deadline && (
					<p className="mt-1 text-sm text-muted">
						{replaceVars(
							translations['order-return.storefront.deadline'],
							{
								date:
									formatDate(deadline, undefined, {
										customFormat: DATE_FORMAT,
										language: getLanguageClient(),
									}) ?? '',
							},
						)}
					</p>
				)}
			</div>

			<ul className="divide-y divide-border">
				{returnable.lines.map((line) => (
					<li
						key={line.variant_id}
						className="flex flex-wrap items-center justify-between gap-3 py-2"
					>
						<label
							htmlFor={`return-line-${line.variant_id}`}
							className="min-w-0 flex-1 text-sm"
						>
							{displayOrderReturnLineLabel(line)}
							<span className="block text-xs text-muted">
								{replaceVars(
									translations[
										'order-return.storefront.quantity_of'
									],
									{ quantity: Number(line.returnable) },
								)}
							</span>
						</label>
						<input
							id={`return-line-${line.variant_id}`}
							type="number"
							min={0}
							max={Number(line.returnable)}
							step="any"
							inputMode="decimal"
							className="w-24 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
							value={quantities[line.variant_id] ?? ''}
							placeholder="0"
							disabled={isPending}
							onChange={(event) =>
								setQuantities((current) => ({
									...current,
									[line.variant_id]:
										event.target.value === ''
											? 0
											: Number(event.target.value),
								}))
							}
						/>
					</li>
				))}
			</ul>

			<div className="flex flex-col gap-1">
				<label htmlFor={reasonId} className="text-sm font-medium">
					{translations['order-return.storefront.reason']}
				</label>
				<select
					id={reasonId}
					className="w-full max-w-sm rounded-md border border-border bg-transparent px-2 py-2 text-sm"
					value={reason}
					disabled={isPending}
					onChange={(event) =>
						setReason(event.target.value as OrderReturnReason)
					}
				>
					<option value="" />
					{reasons.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			<div className="flex flex-col gap-1">
				<label htmlFor={messageId} className="text-sm font-medium">
					{translations['order-return.storefront.message']}
				</label>
				<textarea
					id={messageId}
					className="min-h-20 w-full rounded-md border border-border bg-transparent p-2 text-sm"
					maxLength={ORDER_RETURN_NOTES_MAX}
					value={message}
					placeholder={
						translations[
							'order-return.storefront.message_placeholder'
						]
					}
					disabled={isPending}
					onChange={(event) => setMessage(event.target.value)}
				/>
			</div>

			{problem && <p className="text-sm text-danger">{problem}</p>}

			<div className="flex flex-wrap gap-2">
				<Button type="submit" size="sm" disabled={isPending}>
					{translations['order-return.storefront.submit']}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={isPending}
					onClick={onDone}
				>
					{translations['order-return.storefront.discard']}
				</Button>
			</div>
		</form>
	);
}

/** One request as the buyer follows it: its status, the items, the shop's answer and the parcel. */
function ReturnRow({
	orderId,
	entry,
	translations,
}: {
	readonly orderId: number;
	readonly entry: OrderReturnModel;
	readonly translations: TranslationsType;
}): JSX.Element {
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const { openDialog, dialogProps } = useConfirmationDialog();

	const { mutateAsync: cancel, isPending } = useMutation({
		mutationFn: () => requestCancelOwnOrderReturn(orderId, entry.id),
		onSuccess: async () => {
			showToast({
				severity: 'success',
				summary: translations['order-return.storefront.cancel_success'],
			});

			await queryClient.invalidateQueries({
				queryKey: [...OWN_ORDERS_QUERY_KEY],
			});
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['order-return.storefront.cancel_failed'],
				detail: getErrorMessage(error),
			}),
	});

	return (
		<li className="space-y-2 py-4">
			<div className="flex flex-wrap items-center gap-3">
				<span className="font-semibold tabular-nums">
					{displayOrderReturnReference(entry)}
				</span>
				<DisplayStatus
					status={entry.status}
					dataSource="order-return"
				/>
				<span className="text-sm text-muted">
					{replaceVars(
						translations['order-return.storefront.requested_on'],
						{
							date:
								formatDate(entry.created_at, undefined, {
									customFormat: DATE_FORMAT,
									language: getLanguageClient(),
								}) ?? '',
						},
					)}
				</span>
				{entry.status === OrderReturnStatusEnum.REQUESTED && (
					<div className="ml-auto">
						<Button
							type="button"
							variant="outline"
							hover="error"
							size="sm"
							disabled={isPending}
							onClick={() =>
								openDialog({
									title: translations[
										'order-return.storefront.cancel_title'
									],
									description:
										translations[
											'order-return.storefront.cancel_confirm'
										],
									// The failure is already toasted by `onError`
									onConfirm: () =>
										cancel().then(
											() => undefined,
											() => undefined,
										),
									buttonConfirm: { hover: 'error' },
								})
							}
						>
							{translations['order-return.storefront.cancel']}
						</Button>
					</div>
				)}
			</div>

			<p className="text-sm">
				{translateEnumLabel(
					translations,
					'order-return.enum.reason',
					entry.reason,
				)}
				{entry.customer_notes && (
					<span className="text-muted">
						{' '}
						- {entry.customer_notes}
					</span>
				)}
			</p>

			<ul className="text-sm text-muted">
				{(entry.lines ?? []).map((line) => (
					<li key={line.id}>
						{Number(line.quantity)} x{' '}
						{displayOrderReturnLineLabel(line)}
					</li>
				))}
			</ul>

			{entry.response && (
				<p className="rounded-lg bg-surface-secondary p-3 text-sm">
					<span className="font-medium">
						{translations['order-return.storefront.response']}
					</span>{' '}
					{entry.response}
				</p>
			)}

			{entry.shipping?.tracking_number && (
				<p className="text-sm">
					{translations['order-return.storefront.tracking']}{' '}
					{entry.shipping.tracking_url ? (
						<a
							href={entry.shipping.tracking_url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-accent underline"
						>
							{entry.shipping.tracking_number}
						</a>
					) : (
						entry.shipping.tracking_number
					)}
				</p>
			)}

			<ConfirmationDialog {...dialogProps} />
		</li>
	);
}

/**
 * The returns of one of the buyer's orders, and the way to ask for one. Shown only for an order
 * whose goods may have arrived - the caller decides from the order's status; whether anything is
 * still returnable, and until when, is read from the backend when the form opens.
 */
export function AccountOrderReturns({
	orderId,
	sectionId,
}: {
	readonly orderId: number;
	readonly sectionId: string;
}): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const [isRequesting, setIsRequesting] = useState(false);

	const returnsQuery = useQuery({
		queryKey: returnsQueryKey(orderId),
		queryFn: async () =>
			getResponseData(await requestOwnOrderReturns(orderId))?.entries ??
			[],
	});

	const entries = returnsQuery.data ?? [];

	return (
		<section
			id={sectionId}
			className="scroll-mt-24 space-y-4 rounded-2xl border border-border bg-surface p-6"
		>
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="text-lg font-semibold">
					{translations['order-return.storefront.heading']}
				</h2>
				{!isRequesting && (
					<div className="ml-auto">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setIsRequesting(true)}
						>
							{translations['order-return.storefront.request']}
						</Button>
					</div>
				)}
			</div>

			{isRequesting && (
				<ReturnRequestForm
					orderId={orderId}
					translations={translations}
					onDone={() => setIsRequesting(false)}
				/>
			)}

			{returnsQuery.isPending ? (
				<p className="text-sm text-muted">
					{translations['order-return.storefront.loading']}
				</p>
			) : returnsQuery.isError ? (
				<p className="text-sm text-danger">
					{translations['order-return.storefront.error']}
				</p>
			) : entries.length === 0 ? (
				!isRequesting && (
					<p className="text-sm text-muted">
						{translations['order-return.storefront.empty']}
					</p>
				)
			) : (
				<ul className="divide-y divide-border">
					{entries.map((entry) => (
						<ReturnRow
							key={entry.id}
							orderId={orderId}
							entry={entry}
							translations={translations}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
