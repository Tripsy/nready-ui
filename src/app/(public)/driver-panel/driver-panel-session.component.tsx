import { useCallback, useMemo } from 'react';
import type { WorkSessionVehicleFormValuesType } from '@/app/(public)/_components/work-session-vehicle/form-manage-work-session-vehicle.component';
import { useAttachCmrToSession } from '@/app/(public)/_hooks/use-attach-cmr-to-session.hook';
import { useDriverCashBalance } from '@/app/(public)/_hooks/use-driver-cash-balance.hook';
import { useWorkSession } from '@/app/(public)/_providers/work-session.provider';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/helpers/date.helper';
import { DisplayAmount } from '@/helpers/display.helper';
import { getErrorMessage } from '@/helpers/error.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CmrModel } from '@/models/cmr.model';
import { displayWorkSessionDuration } from '@/models/work-session.model';
import { useToast } from '@/providers/toast.provider';
import { createWorkSessionVehicle } from '@/services/work-session-vehicle.service';
import { useModalStore } from '@/stores/window.store';
import { CurrencyEnum } from '@/types/common.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';

export function DriverPanelSession() {
	const open = useModalStore((s) => s.open);
	const { showToast } = useToast();
	const attachCmrToSession = useAttachCmrToSession();
	const {
		activeSession,
		activeSessionVehicleAuto,
		setActiveTab,
		refreshSession,
	} = useWorkSession();

	const translationsKeys = [
		'app.error.title',
		'driver-panel.tooltip.add_session_vehicle',
		'driver-panel.tooltip.create_cmr',
		'driver-panel.tooltip.close_session',
	] as const;
	const { translations } = useTranslation(translationsKeys);

	const { data: ronData } = useDriverCashBalance(CurrencyEnum.RON);
	const { data: eurData } = useDriverCashBalance(CurrencyEnum.EUR);
	const { data: usdData } = useDriverCashBalance(CurrencyEnum.USD);

	const balances = useMemo(
		() => [
			{ currency: CurrencyEnum.RON, balance: ronData?.balance ?? 0 },
			{ currency: CurrencyEnum.EUR, balance: eurData?.balance ?? 0 },
			{ currency: CurrencyEnum.USD, balance: usdData?.balance ?? 0 },
		],
		[ronData?.balance, eurData?.balance, usdData?.balance],
	);

	// `window-action.component.tsx` invokes `windowEvents?.success?.()` without
	// awaiting it, so a rejection inside these handlers escapes its try/catch — by
	// then the success toast has shown and the window has closed. Report the failure
	// here rather than losing it.
	const reportFailure = useCallback(
		(error: unknown) => {
			showToast({
				severity: 'error',
				summary: translations['app.error.title'],
				detail: getErrorMessage(error),
			});
		},
		[showToast, translations],
	);

	const handleCreateSessionVehicle = useCallback(() => {
		if (!activeSession) {
			return;
		}

		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'work-session-vehicle',
			action: 'create',
			definition: {
				operationFunction: (params: WorkSessionVehicleFormValuesType) =>
					createWorkSessionVehicle(params, activeSession.id),
			},
			events: {
				success: async () => {
					try {
						await refreshSession();

						setActiveTab('sessionVehicles');
					} catch (error) {
						reportFailure(error);
					}
				},
			},
		});
	}, [open, activeSession, refreshSession, setActiveTab, reportFailure]);

	const handleCreateCmr = useCallback(() => {
		if (!activeSession || !activeSessionVehicleAuto) {
			return;
		}

		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'cmr',
			action: 'create',
			events: {
				success: async (cmr?: CmrModel) => {
					if (!cmr) {
						return;
					}

					await attachCmrToSession(cmr.id);
				},
			},
		});
	}, [open, activeSession, activeSessionVehicleAuto, attachCmrToSession]);

	const handleCloseSession = useCallback(() => {
		if (!activeSession) {
			return;
		}

		open({
			minimized: false,
			section: DataSourceSectionEnum.PUBLIC,
			dataSource: 'work-session',
			action: 'close',
			data: {
				entries: [activeSession],
			},
			events: {
				success: async () => {
					try {
						await refreshSession();
					} catch (error) {
						reportFailure(error);
					}
				},
			},
		});
	}, [open, activeSession, refreshSession, reportFailure]);

	if (!activeSession) {
		return null;
	}

	return (
		<div className="flex gap-x-4 p-2 shadow-lg bg-surface">
			<div className="flex flex-1 flex-col md:flex-row gap-x-4 gap-y-1">
				<div className="flex items-center gap-x-2">
					<div className="flex items-center bg-background-secondary p-3 rounded-lg">
						<Icons.Calendar />
					</div>
					<div className="flex items-center text-sm whitespace-nowrap">
						{formatDate(activeSession.start_at, undefined, {
							customFormat: 'D MMMM, HH:mm',
						})}
					</div>
				</div>
				<div className="flex items-center gap-x-2">
					<div className="flex items-center bg-background-secondary p-3 rounded-lg">
						<Icons.Clock />
					</div>
					<div className="flex items-center text-sm whitespace-nowrap">
						{displayWorkSessionDuration(activeSession)}
					</div>
				</div>
				<div className="flex items-center gap-x-2">
					<div className="flex items-center bg-background-secondary p-3 rounded-lg">
						<Icons.CashFlow />
					</div>
					<div className="flex flex-row items-center gap-x-2">
						{balances
							.filter(({ balance }) => balance !== 0)
							.map(({ currency, balance }) => (
								<div key={currency}>
									<DisplayAmount
										amount={balance}
										currencyCode={currency}
										classNamePositive="text-success"
									/>
								</div>
							))}
					</div>
				</div>
			</div>
			<div className="flex flex-col md:flex-row items-center justify-center md:justify-end gap-2">
				<Button
					variant={activeSessionVehicleAuto ? 'secondary' : 'warning'}
					hover="success"
					onClick={handleCreateSessionVehicle}
					title={
						translations['driver-panel.tooltip.add_session_vehicle']
					}
				>
					<Icons.Vehicle />
				</Button>
				{activeSessionVehicleAuto && (
					<Button
						variant="secondary"
						hover="success"
						onClick={handleCreateCmr}
						title={translations['driver-panel.tooltip.create_cmr']}
					>
						<Icons.Cmr />
					</Button>
				)}
				<Button
					variant="secondary"
					hover="error"
					onClick={handleCloseSession}
					title={translations['driver-panel.tooltip.close_session']}
				>
					<Icons.Action.Close />
				</Button>
			</div>
		</div>
	);
}
