'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { DisplayStatus } from '@/helpers/display.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	ORDER_RETURN_MANUAL_STATUSES,
	ORDER_RETURN_STATUS_TRANSITIONS,
	type OrderReturnModel,
	type OrderReturnStatus,
	OrderReturnStatusEnum,
} from '@/models/order-return.model';
import { useToast } from '@/providers/toast.provider';
import { requestUpdateOrderReturnStatus } from '@/services/order-return.service';
import { useModalStore } from '@/stores/window.store';

const TRANSLATION_KEYS = [
	'order-return.text.change_status_to',
	'order-return.text.reject_effect',
	'order-return.text.cancel_effect',
	'order-return.text.cancel_approved_effect',
	'order-return.text.close_effect',
	'order-return.field.response',
	'order-return.text.placeholder_response',
	'dashboard.text.label_set_status_to',
	'app.error.title',
	'app.success.title',
	'order-return.error.cannot_update_status',
	'order-return.action.statusTransition.success',
	...enumTranslationKeys('order-return.status', OrderReturnStatusEnum),
] as const;

/**
 * Reject, cancel or close a return - the moves the status route takes. Approving has its own form
 * (it writes the return shipment) and `received` follows that shipment, so neither is offered here.
 *
 * The buyer is shown `response`, so the window asks for it alongside the move - a rejection without
 * a reason is the case it is there for. Canceling an approved return also withdraws its shipment,
 * which the backend refuses once the goods are on their way; the refusal arrives as the toast.
 */
export function StatusTransitionOrderReturn({
	entries,
}: {
	entries: OrderReturnModel[];
}) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const { isTranslationLoading, translations } =
		useTranslation(TRANSLATION_KEYS);

	const responseId = useId();

	const entry = entries[0];

	const [response, setResponse] = useState(entry?.response ?? '');

	const statusTransitions = useMemo(
		() =>
			entry
				? getStatusTransitions(
						entry.status,
						ORDER_RETURN_STATUS_TRANSITIONS,
					).filter((status) =>
						ORDER_RETURN_MANUAL_STATUSES.includes(status),
					)
				: [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: OrderReturnModel, status: OrderReturnStatus) => {
			try {
				await requestUpdateOrderReturnStatus(
					entry.id,
					status,
					response.trim() || null,
				);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[
						'order-return.action.statusTransition.success'
					],
				});

				dispatchFilterReset('order-return');
			} catch (error) {
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: (error as Error).message,
				});
			} finally {
				close();
			}
		},
		[showToast, translations, close, response],
	);

	if (!entry) {
		return <ErrorComponent />;
	}

	if (isTranslationLoading) {
		return <LoadingComponent />;
	}

	if (!statusTransitions.length) {
		return (
			<ErrorComponent
				description={
					translations['order-return.error.cannot_update_status']
				}
			/>
		);
	}

	const effectOf = (status: OrderReturnStatus): string => {
		if (status === OrderReturnStatusEnum.REJECTED) {
			return translations['order-return.text.reject_effect'];
		}

		if (status === OrderReturnStatusEnum.CLOSED) {
			return translations['order-return.text.close_effect'];
		}

		return entry.status === OrderReturnStatusEnum.APPROVED
			? translations['order-return.text.cancel_approved_effect']
			: translations['order-return.text.cancel_effect'];
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-1">
				<label htmlFor={responseId} className="text-sm font-medium">
					{translations['order-return.field.response']}
				</label>
				<textarea
					id={responseId}
					className="min-h-20 w-full rounded-md border border-line bg-transparent p-2 text-sm"
					value={response}
					placeholder={
						translations['order-return.text.placeholder_response']
					}
					onChange={(event) => setResponse(event.target.value)}
				/>
			</div>

			<p className="font-semibold">
				{translations['order-return.text.change_status_to']}
			</p>
			<div className="flex flex-col gap-4">
				{statusTransitions.map((status) => (
					<div key={status} className="flex items-start gap-4">
						<button
							type="button"
							className="shrink-0 cursor-pointer"
							aria-label={replaceVars(
								translations[
									'dashboard.text.label_set_status_to'
								],
								{
									status: translateEnumLabel(
										translations,
										'order-return.status',
										status,
									),
								},
							)}
							onClick={() => handleStatusUpdate(entry, status)}
						>
							<DisplayStatus
								status={status}
								dataSource="order-return"
							/>
						</button>
						<p className="text-sm text-muted">{effectOf(status)}</p>
					</div>
				))}
			</div>
		</div>
	);
}
