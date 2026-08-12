'use client';

import { useCallback, useMemo } from 'react';
import {
	ErrorComponent,
	LoadingComponent,
} from '@/components/status.component';
import { DisplayStatus } from '@/helpers/display.helper';
import { getStatusTransitions } from '@/helpers/model.helper';
import { requestUpdateStatus } from '@/helpers/services.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type CmrModel,
	type CmrStatus,
	STATUS_TRANSITIONS,
} from '@/models/cmr.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

export function StatusTransitionCmr({ entries }: { entries: CmrModel[] }) {
	const { close, getCurrentWindow } = useModalStore();

	const windowConfig = getCurrentWindow();
	const windowEvents = windowConfig?.events;

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'cmr.error.cannot_update_status',
		'cmr.action.statusTransition.success',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const entry = entries[0];

	const statusTransitions = useMemo(
		() =>
			entry ? getStatusTransitions(entry.status, STATUS_TRANSITIONS) : [],
		[entry],
	);

	const handleStatusUpdate = useCallback(
		async (entry: CmrModel, status: CmrStatus) => {
			try {
				await requestUpdateStatus('cmr', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations['cmr.action.statusTransition.success'],
				});

				windowEvents?.success?.();
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
		[showToast, translations, close, windowEvents],
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
				description={translations['cmr.error.cannot_update_status']}
			/>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">Change CMR status to:</p>
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
							<DisplayStatus status={status} dataSource="cmr" />
						</button>
					);
				})}
			</div>
		</div>
	);
}
