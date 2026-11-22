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
import {
	enumTranslationKeys,
	replaceVars,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	GRN_STATUS_TRANSITIONS,
	type GrnModel,
	type GrnStatus,
	GrnStatusEnum,
} from '@/models/grn.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

const TRANSLATION_KEYS = [
	'grn.text.change_status_to',
	'grn.text.confirm_effect',
	'grn.text.cancel_draft_effect',
	'grn.text.cancel_confirmed_effect',
	'dashboard.text.label_set_status_to',
	'app.error.title',
	'app.success.title',
	'grn.error.cannot_update_status',
	'grn.action.statusTransition.success',
	...enumTranslationKeys('grn.status', GrnStatusEnum),
] as const;

/**
 * Where a receipt may go from where it stands, drawn from the map the backend enforces.
 *
 * Both moves out of a draft have consequences an operator should read before clicking, so the
 * window says what each one does: confirming moves stock and re-averages cost, canceling a
 * confirmed receipt posts the reversals and is refused once a lot has been drawn from. The backend's
 * refusal arrives as the toast's message.
 */
export function StatusTransitionGrn({ entries }: { entries: GrnModel[] }) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const { isTranslationLoading, translations } =
		useTranslation(TRANSLATION_KEYS);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry
				? getStatusTransitions(entry.status, GRN_STATUS_TRANSITIONS)
				: [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: GrnModel, status: GrnStatus) => {
			try {
				await requestUpdateStatus('grn', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations['grn.action.statusTransition.success'],
				});

				dispatchFilterReset('grn');
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
				description={translations['grn.error.cannot_update_status']}
			/>
		);
	}

	const effectOf = (status: GrnStatus): string => {
		if (status === GrnStatusEnum.CONFIRMED) {
			return translations['grn.text.confirm_effect'];
		}

		return entry.status === GrnStatusEnum.CONFIRMED
			? translations['grn.text.cancel_confirmed_effect']
			: translations['grn.text.cancel_draft_effect'];
	};

	return (
		<div>
			<p className="pb-4 font-semibold">
				{translations['grn.text.change_status_to']}
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
										'grn.status',
										status,
									),
								},
							)}
							onClick={() => handleStatusUpdate(entry, status)}
						>
							<DisplayStatus status={status} dataSource="grn" />
						</button>
						<p className="text-sm text-muted">{effectOf(status)}</p>
					</div>
				))}
			</div>
		</div>
	);
}
