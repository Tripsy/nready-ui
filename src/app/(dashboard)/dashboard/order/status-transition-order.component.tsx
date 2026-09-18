'use client';

import { useCallback, useMemo } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { DisplayStatus } from '@/helpers/display.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { requestUpdateStatus } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	ORDER_STATUS_TRANSITIONS,
	type OrderModel,
	type OrderStatus,
} from '@/models/order.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

/**
 * Where the document may go from where it currently sits.
 *
 * An order has a forward step and a withdrawal available from most of its states - a pending one
 * can be confirmed or canceled, a confirmed one completed or canceled - so the status badge cannot act on one
 * click. It opens this instead, and the moves are drawn from the same transition map the backend
 * enforces, so a button is never offered for a move that would come back 409. A `completed` or
 * `canceled` order offers nothing, which is what makes both terminal.
 */
export function StatusTransitionOrder({ entries }: { entries: OrderModel[] }) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'order.error.cannot_update_status',
		'order.action.statusTransition.success',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry
				? getStatusTransitions(entry.status, ORDER_STATUS_TRANSITIONS)
				: [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: OrderModel, status: OrderStatus) => {
			try {
				await requestUpdateStatus('order', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[
						'order.action.statusTransition.success'
					],
				});

				dispatchFilterReset('order');
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
		[showToast, translations, close],
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
				description={translations['order.error.cannot_update_status']}
			/>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">Change order status to:</p>
			<div className="flex flex-wrap gap-4 items-center">
				{statusTransitions.map((status) => {
					return (
						<button
							key={status}
							type="button"
							className="cursor-pointer"
							aria-label={`Set status to ${status}`}
							onClick={() => handleStatusUpdate(entry, status)}
						>
							<DisplayStatus status={status} dataSource="order" />
						</button>
					);
				})}
			</div>
		</div>
	);
}
