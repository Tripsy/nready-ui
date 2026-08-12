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
	type CompanyVehicleModel,
	type CompanyVehicleStatus,
	STATUS_TRANSITIONS,
} from '@/models/company-vehicle.model';
import { useToast } from '@/providers/toast.provider';
import { useModalStore } from '@/stores/window.store';

export function StatusTransitionCompanyVehicle({
	entries,
}: {
	entries: CompanyVehicleModel[];
}) {
	const { close } = useModalStore();

	const { showToast } = useToast();

	const translationsKeys = [
		'app.error.title',
		'app.success.title',
		'company-vehicle.error.cannot_update_status',
		'company-vehicle.action.statusTransition.success',
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
		async (entry: CompanyVehicleModel, status: CompanyVehicleStatus) => {
			try {
				await requestUpdateStatus('company-vehicle', entry, status);

				showToast({
					severity: 'success',
					summary: translations['app.success.title'],
					detail: translations[
						'company-vehicle.action.statusTransition.success'
					],
				});

				dispatchFilterReset('company-vehicle');
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
					translations['company-vehicle.error.cannot_update_status']
				}
			/>
		);
	}

	return (
		<div>
			<p className="pb-4 font-semibold">
				Change company vehicle status to:
			</p>
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
								dataSource="company-vehicle"
							/>
						</button>
					);
				})}
			</div>
		</div>
	);
}
