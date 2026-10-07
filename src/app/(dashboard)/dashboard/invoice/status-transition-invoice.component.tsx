'use client';

import { useMemo, useState } from 'react';
import { dispatchFilterReset } from '@/app/(dashboard)/_events/data-table-filter-reset.event';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { DisplayStatus } from '@/helpers/display.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { requestUpdateStatus } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type InvoiceModel,
	type InvoiceStatus,
	InvoiceStatusEnum,
	STATUS_TRANSITIONS,
} from '@/models/invoice.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

/**
 * Where the document may go from where it currently sits - a draft is issued or canceled, an
 * issued document can only be canceled. The moves are drawn from the same transition map the
 * backend enforces, so a status is never offered for a move that would come back 409.
 *
 * Unlike an order, a move is not made on one click: issuing spends a number from the series and
 * freezes the parties onto the document, and neither move can be undone. Picking a status asks
 * first, with what that move commits to.
 */
export function StatusTransitionInvoice({
	entries,
}: {
	entries: InvoiceModel[];
}) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'invoice.action.statusTransition.confirm_issued',
		'invoice.action.statusTransition.confirm_canceled',
		'invoice.action.statusTransition.success_issued',
		'invoice.action.statusTransition.success_canceled',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const [pending, setPending] = useState<InvoiceStatus | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry ? getStatusTransitions(entry.status, STATUS_TRANSITIONS) : [],
		[entry],
	);

	if (!entry) {
		return <ErrorComponent />;
	}

	if (isTranslationLoading) {
		return <LoadingComponent />;
	}

	if (!statusTransitions.length) {
		return (
			<ErrorComponent description="This invoice cannot change status any more." />
		);
	}

	// Only `issued` and `canceled` are ever a target - `draft` is where a document starts
	const messageFor = (status: InvoiceStatus, kind: 'confirm' | 'success') =>
		translations[
			`invoice.action.statusTransition.${kind}_${status === InvoiceStatusEnum.ISSUED ? 'issued' : 'canceled'}`
		];

	const handleConfirm = async (status: InvoiceStatus) => {
		setIsSaving(true);

		try {
			// A refusal rejects with the API's message, which the catch shows
			await requestUpdateStatus('invoice', entry, status);

			showToast({
				severity: 'success',
				summary: translations['app.success.title'],
				detail: messageFor(status, 'success'),
			});

			dispatchFilterReset('invoice');

			close();
		} catch (error) {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: (error as Error).message,
			});
		} finally {
			setIsSaving(false);
		}
	};

	if (pending) {
		return (
			<div>
				<div className="flex items-center gap-2 pb-4">
					<span className="font-semibold">Change status to:</span>
					<DisplayStatus status={pending} dataSource="invoice" />
				</div>

				<p className="pb-4">{messageFor(pending, 'confirm')}</p>

				<div className="flex justify-end gap-3">
					<Button
						variant="outline"
						hover="warning"
						disabled={isSaving}
						onClick={() => setPending(null)}
					>
						Back
					</Button>

					<Button
						variant="default"
						disabled={isSaving}
						onClick={() => handleConfirm(pending)}
					>
						Confirm
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">Change invoice status to:</p>
			<div className="flex flex-wrap gap-4 items-center">
				{statusTransitions.map((status) => (
					<button
						key={status}
						type="button"
						className="cursor-pointer"
						aria-label={`Set status to ${status}`}
						onClick={() => setPending(status)}
					>
						<DisplayStatus status={status} dataSource="invoice" />
					</button>
				))}
			</div>
		</div>
	);
}
