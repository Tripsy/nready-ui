'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { JSX } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { getErrorMessage } from '@/helpers/error.helper';
import { useConfirmationDialog } from '@/hooks/use-confirmation-dialog';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useToast } from '@/providers/toast.provider';
import {
	OWN_ORDERS_QUERY_KEY,
	requestCancelOwnOrder,
} from '@/services/order.service';

const TRANSLATION_KEYS = [
	'order.storefront.cancel',
	'order.storefront.cancel_title',
	'order.storefront.cancel_confirm',
	'order.storefront.cancel_success',
	'order.storefront.cancel_failed',
] as const;

/**
 * Lets the buyer withdraw a pending order, behind a confirmation. Shown by the list and the
 * detail page alike; the caller decides when - only for a `pending` order.
 *
 * The backend has the last word: an order invoiced or paid in the meantime answers 409, and its
 * message - what to do instead - is shown as is. On success every account-order read is dropped,
 * so the status, the delivery and the button itself follow from a fresh read.
 *
 * `iconOnly` is the compact form a list row uses: the label moves to `aria-label` and the
 * pointer tooltip, so the button still names itself to a screen reader.
 */
export function CancelOrderButton({
	orderId,
	iconOnly = false,
}: {
	readonly orderId: number;
	readonly iconOnly?: boolean;
}): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const { openDialog, dialogProps } = useConfirmationDialog();

	const { mutateAsync: cancel, isPending } = useMutation({
		mutationFn: () => requestCancelOwnOrder(orderId),
		onSuccess: async () => {
			showToast({
				severity: 'success',
				summary: translations['order.storefront.cancel_success'],
			});

			await queryClient.invalidateQueries({
				queryKey: OWN_ORDERS_QUERY_KEY,
			});
		},
		onError: (error) =>
			showToast({
				severity: 'error',
				summary: translations['order.storefront.cancel_failed'],
				detail: getErrorMessage(error),
			}),
	});

	return (
		<>
			<Button
				type="button"
				variant="outline"
				hover="error"
				size="sm"
				disabled={isPending}
				aria-label={
					iconOnly
						? translations['order.storefront.cancel']
						: undefined
				}
				title={
					iconOnly
						? translations['order.storefront.cancel']
						: undefined
				}
				onClick={() =>
					openDialog({
						title: translations['order.storefront.cancel_title'],
						description:
							translations['order.storefront.cancel_confirm'],
						// The failure is already toasted by `onError`; the dialog only has to close
						onConfirm: () =>
							cancel().then(
								() => undefined,
								() => undefined,
							),
						buttonConfirm: { hover: 'error' },
					})
				}
			>
				{iconOnly ? (
					<X className="h-4 w-4" aria-hidden="true" />
				) : (
					translations['order.storefront.cancel']
				)}
			</Button>

			<ConfirmationDialog {...dialogProps} />
		</>
	);
}
