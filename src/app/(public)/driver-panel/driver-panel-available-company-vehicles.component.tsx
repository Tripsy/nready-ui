import { useCallback } from 'react';
import type { WorkSessionVehicleFormValuesType } from '@/app/(public)/_components/work-session-vehicle/form-manage-work-session-vehicle.component';
import { useWorkSession } from '@/app/(public)/_providers/work-session.provider';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import type { WorkSessionModel } from '@/models/work-session.model';
import { createWorkSessionVehicle } from '@/services/work-session-vehicle.service';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

const TRANSLATION_KEYS = [
	'driver-panel.button.pick',
	'driver-panel.tooltip.pick_vehicle',
] as const;

export function DriverPanelAvailableCompanyVehicles({
	activeSession,
	availableCompanyVehicles,
}: {
	activeSession: WorkSessionModel;
	availableCompanyVehicles: CompanyVehicleModel[];
}) {
	const open = useModalStore((s) => s.open);
	const { refreshSession } = useWorkSession();
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const handlePickSessionVehicle = useCallback(
		(entry: CompanyVehicleModel, workSession: WorkSessionModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'work-session-vehicle',
				action: 'create',
				data: {
					prefillEntry: {
						company_vehicle: entry,
					},
				},
				definition: {
					operationFunction: (
						values: WorkSessionVehicleFormValuesType,
					) => {
						return createWorkSessionVehicle(values, workSession.id);
					},
				},
				events: {
					success: async () => {
						await refreshSession();
					},
				},
			});
		},
		[open, refreshSession],
	);

	return (
		<div className="space-y-4">
			{availableCompanyVehicles.map((m) => (
				<div
					key={m.id}
					className="bg-surface border border-border rounded-lg p-4 mb-4"
				>
					<div className="flex justify-between">
						<div className="flex flex-col justify-between items-start self-stretch">
							<h3 className="font-semibold text-surface-foreground">
								{m.vehicle?.brand?.name} {m.vehicle.model}
							</h3>
							<div>
								<span className="text-muted">
									{m.license_plate}
								</span>
							</div>
						</div>

						<div className="flex flex-col items-end gap-2">
							<Button
								variant="success"
								onClick={() =>
									handlePickSessionVehicle(m, activeSession)
								}
								className="cursor-pointer"
								title={
									translations[
										'driver-panel.tooltip.pick_vehicle'
									]
								}
							>
								<Icons.Action.Add className="h-4 w-4" />{' '}
								{translations['driver-panel.button.pick']}
							</Button>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
