import { useCallback, useMemo, useState } from 'react';
import type { WorkSessionVehicleFormValuesType } from '@/app/(public)/_components/work-session-vehicle/form-manage-work-session-vehicle.component';
import { useWorkSession } from '@/app/(public)/_providers/work-session.provider';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { DisplayStatus } from '@/helpers/display.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	CashFlowCategoryEnum,
	CashFlowMethodEnum,
	OperationalRecordTypeEnum,
} from '@/models/cash-flow.model';
import { displayCompanyVehicleLabel } from '@/models/company-vehicle.model';
import { VehicleTypeEnum } from '@/models/vehicle.model';
import {
	type WorkSessionVehicleModel,
	type WorkSessionVehicleStatus,
	WorkSessionVehicleStatusEnum,
} from '@/models/work-session-vehicle.model';
import { updateWorkSessionVehicle } from '@/services/work-session-vehicle.service';
import { useModalStore } from '@/stores/window.store';
import { DataSourceSectionEnum } from '@/types/data-source.type';

// Full map over WorkSessionVehicleStatus so a new status must be ranked here.
const STATUS_ORDER: Record<WorkSessionVehicleStatus, number> = {
	[WorkSessionVehicleStatusEnum.ASSIGNED]: 0,
	[WorkSessionVehicleStatusEnum.RETURNED]: 1,
};

const TRANSLATION_KEYS = [
	'driver-panel.field.range_km',
	'driver-panel.button.fuel',
	'driver-panel.button.toll',
	'driver-panel.button.show_returned',
	'driver-panel.button.hide_returned',
	'driver-panel.tooltip.add_fuel_payment',
	'driver-panel.tooltip.add_toll_payment',
	'driver-panel.tooltip.return_vehicle',
	'driver-panel.tooltip.update_vehicle',
	'driver-panel.tooltip.delete_vehicle',
	'driver-panel.tooltip.show_returned_vehicles',
	'driver-panel.tooltip.hide_returned_vehicles',
] as const;

export function DriverPanelSessionVehicles({
	sessionVehicles,
}: {
	sessionVehicles: WorkSessionVehicleModel[];
}) {
	const open = useModalStore((s) => s.open);
	const { setActiveTab, refreshSession, refetchSessionCashFlowEntries } =
		useWorkSession();
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const [withReturned, setWithReturned] = useState(false);

	// update and return submit the same backend call; share one operation builder.
	const buildUpdateOperation = useCallback(
		(entry: WorkSessionVehicleModel) =>
			(values: WorkSessionVehicleFormValuesType) =>
				updateWorkSessionVehicle(
					values,
					entry.id,
					entry.work_session.id,
				),
		[],
	);

	const handleUpdateSessionVehicle = useCallback(
		(entry: WorkSessionVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'work-session-vehicle',
				action: 'update',
				data: {
					entries: [entry],
				},
				definition: {
					operationFunction: buildUpdateOperation(entry),
				},
				events: {
					success: async () => {
						await refreshSession();
					},
				},
			});
		},
		[open, refreshSession, buildUpdateOperation],
	);

	const handleDeleteSessionVehicle = useCallback(
		(entry: WorkSessionVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'work-session-vehicle',
				action: 'delete',
				data: {
					entries: [entry],
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

	const handleStatusReturnSessionVehicle = useCallback(
		(entry: WorkSessionVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'work-session-vehicle',
				action: 'return',
				data: {
					entries: [entry],
				},
				definition: {
					operationFunction: buildUpdateOperation(entry),
				},
				events: {
					success: async () => {
						await refreshSession();
					},
				},
			});
		},
		[open, refreshSession, buildUpdateOperation],
	);

	const handleCreatePaymentFuel = useCallback(
		(entry: WorkSessionVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cash-flow',
				action: 'create',
				data: {
					prefillEntry: {
						category: CashFlowCategoryEnum.FUEL,
						method: CashFlowMethodEnum.CREDIT_CARD,
						operational_records: {
							[OperationalRecordTypeEnum.EMPLOYEE]:
								entry.work_session.user,
							[OperationalRecordTypeEnum.COMPANY_VEHICLE]:
								entry.company_vehicle,
						},
					},
				},
				events: {
					success: async () => {
						await refetchSessionCashFlowEntries();

						setActiveTab('sessionCashFlowEntries');
					},
				},
			});
		},
		[open, refetchSessionCashFlowEntries, setActiveTab],
	);

	const handleCreatePaymentToll = useCallback(
		(entry: WorkSessionVehicleModel) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.PUBLIC,
				dataSource: 'cash-flow',
				action: 'create',
				data: {
					prefillEntry: {
						category: CashFlowCategoryEnum.TOLLS,
						operational_records: {
							[OperationalRecordTypeEnum.EMPLOYEE]:
								entry.work_session.user,
							[OperationalRecordTypeEnum.COMPANY_VEHICLE]:
								entry.company_vehicle,
						},
					},
				},
				events: {
					success: async () => {
						await refetchSessionCashFlowEntries();

						setActiveTab('sessionCashFlowEntries');
					},
				},
			});
		},
		[open, refetchSessionCashFlowEntries, setActiveTab],
	);

	const hasReturnedVehicles = sessionVehicles.some(
		(m) => m.status === WorkSessionVehicleStatusEnum.RETURNED,
	);

	const sessionVehiclesSorted = useMemo(
		() =>
			withReturned
				? [...sessionVehicles].sort(
						(a, b) =>
							STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
					)
				: sessionVehicles,
		[withReturned, sessionVehicles],
	);

	return (
		<>
			<div className="space-y-4">
				{sessionVehiclesSorted
					.filter(
						(m) =>
							withReturned ||
							m.status !== WorkSessionVehicleStatusEnum.RETURNED,
					)
					.map((m) => (
						<div
							key={m.id}
							className="bg-surface border border-border rounded-lg p-4"
						>
							<div className="flex justify-between items-center">
								<div className="flex flex-col justify-between items-start self-stretch gap-2">
									<h3 className="font-semibold text-surface-foreground">
										{displayCompanyVehicleLabel(
											m.company_vehicle,
										)}
									</h3>
									<div>
										<span className="text-muted">
											{
												translations[
													'driver-panel.field.range_km'
												]
											}
											:
										</span>
										<span className="ml-2 font-mono">
											{m.vehicle_km_start} -{' '}
											{m.vehicle_km_end}
										</span>
									</div>
									<div>
										<DisplayStatus
											status={m.status}
											dataSource="work-session-vehicle"
										/>
									</div>
								</div>
								<div className="flex gap-x-4">
									{m.status ===
										WorkSessionVehicleStatusEnum.ASSIGNED &&
										m.company_vehicle.vehicle
											.vehicle_type ===
											VehicleTypeEnum.AUTO && (
											<div className="flex flex-col justify-start gap-4">
												<Button
													variant="default"
													hover="success"
													onClick={() =>
														handleCreatePaymentFuel(
															m,
														)
													}
													className="cursor-pointer"
													title={
														translations[
															'driver-panel.tooltip.add_fuel_payment'
														]
													}
												>
													<Icons.Fuel className="h-4 w-4" />{' '}
													{
														translations[
															'driver-panel.button.fuel'
														]
													}
												</Button>

												<Button
													variant="default"
													hover="success"
													onClick={() =>
														handleCreatePaymentToll(
															m,
														)
													}
													className="cursor-pointer"
													title={
														translations[
															'driver-panel.tooltip.add_toll_payment'
														]
													}
												>
													<Icons.Toll className="h-4 w-4" />{' '}
													{
														translations[
															'driver-panel.button.toll'
														]
													}
												</Button>
											</div>
										)}

									<div className="flex flex-col justify-start gap-4">
										{m.status ===
											WorkSessionVehicleStatusEnum.ASSIGNED && (
											<Button
												variant="secondary"
												hover="warning"
												onClick={() =>
													handleStatusReturnSessionVehicle(
														m,
													)
												}
												className="cursor-pointer"
												title={
													translations[
														'driver-panel.tooltip.return_vehicle'
													]
												}
											>
												<Icons.Action.Return className="h-4 w-4" />
											</Button>
										)}
										<Button
											variant="secondary"
											hover="default"
											onClick={() =>
												handleUpdateSessionVehicle(m)
											}
											className="cursor-pointer"
											title={
												translations[
													'driver-panel.tooltip.update_vehicle'
												]
											}
										>
											<Icons.Action.Update className="h-4 w-4" />
										</Button>
										<Button
											variant="secondary"
											hover="error"
											onClick={() =>
												handleDeleteSessionVehicle(m)
											}
											className="cursor-pointer"
											title={
												translations[
													'driver-panel.tooltip.delete_vehicle'
												]
											}
										>
											<Icons.Action.Delete className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						</div>
					))}
			</div>
			<div className="mt-4 flex justify-end">
				{hasReturnedVehicles &&
					(withReturned ? (
						<Button
							variant="outline"
							onClick={() => setWithReturned(false)}
							title={
								translations[
									'driver-panel.tooltip.hide_returned_vehicles'
								]
							}
						>
							<Icons.Obscured className="h-4 w-4" />{' '}
							{translations['driver-panel.button.hide_returned']}
						</Button>
					) : (
						<Button
							variant="outline"
							onClick={() => setWithReturned(true)}
							title={
								translations[
									'driver-panel.tooltip.show_returned_vehicles'
								]
							}
						>
							<Icons.Visible className="h-4 w-4" />{' '}
							{translations['driver-panel.button.show_returned']}
						</Button>
					))}
			</div>
		</>
	);
}
