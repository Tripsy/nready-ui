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
	SHIPPING_STATUS_TRANSITIONS,
	type ShippingModel,
	type ShippingStatus,
} from '@/models/shipping.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

/**
 * Where a parcel may go from where it currently sits.
 *
 * Most states offer more than one move - a shipment being prepared can go out or fail - so the
 * status badge cannot act on one click. The moves are drawn from the same transition map the backend
 * enforces, so a button is never offered for a move that would come back 409.
 *
 * **Marking a shipment shipped has a side effect**: the backend freezes the destination into
 * `address_data` and stamps the dispatch date, and the delivery address can no longer be changed
 * afterwards. `delivered`, `failed` and `returned` end the line.
 */
export function StatusTransitionShipping({
	entries,
}: {
	entries: ShippingModel[];
}) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'shipping.error.cannot_update_status',
		'shipping.action.statusTransition.success',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry
				? getStatusTransitions(
						entry.status,
						SHIPPING_STATUS_TRANSITIONS,
					)
				: [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: ShippingModel, status: ShippingStatus) => {
			try {
				await requestUpdateStatus('shipping', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[
						'shipping.action.statusTransition.success'
					],
				});

				dispatchFilterReset('shipping');
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
				description={
					translations['shipping.error.cannot_update_status']
				}
			/>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">Change shipment status to:</p>
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
							<DisplayStatus
								status={status}
								dataSource="shipping"
							/>
						</button>
					);
				})}
			</div>
		</div>
	);
}
