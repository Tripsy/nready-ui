import { useCallback } from 'react';
import { useWorkSession } from '@/app/(public)/_providers/work-session.provider';
import { getErrorMessage } from '@/helpers/error.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { useToast } from '@/providers/toast.provider';
import { createCmrSession } from '@/services/cmr-session.service';

/**
 * Attaches a CMR to the active work session, refreshes the session, then switches to
 * the CMRs tab.
 *
 * Shared by the two flows that end with a CMR on the current session: creating a new
 * one from the session header, and assigning an existing available one. Both need the
 * identical sequence and the same vehicle assignment, so it lives here rather than
 * being repeated at each call site.
 *
 * Failures are reported here too. Callers reach this from places where the error
 * cannot surface on its own — a window `success` event (invoked un-awaited by
 * `window-action.component.tsx`, so its try/catch never sees the rejection) and an
 * async `onClick` whose promise is dropped.
 */
export function useAttachCmrToSession(): (cmrId: number) => Promise<void> {
	const {
		activeSession,
		activeSessionVehicleAuto,
		activeSessionVehicleTrailer,
		refreshSession,
		setActiveTab,
	} = useWorkSession();
	const { showToast } = useToast();

	const translationsKeys = ['app.error.title'] as const;
	const { translations } = useTranslation(translationsKeys);

	return useCallback(
		async (cmrId: number) => {
			// Both call sites gate their trigger on these being present; this guard
			// covers the session changing between render and invocation.
			if (!activeSession || !activeSessionVehicleAuto) {
				return;
			}

			try {
				await createCmrSession(
					{
						work_session_id: activeSession.id,
						company_vehicle_id_auto: activeSessionVehicleAuto.id,
						company_vehicle_id_trailer:
							activeSessionVehicleTrailer?.id,
					},
					cmrId,
				);

				await refreshSession();

				setActiveTab('sessionCmrs');
			} catch (error) {
				showToast({
					severity: 'error',
					summary: translations['app.error.title'],
					detail: getErrorMessage(error),
				});
			}
		},
		[
			activeSession,
			activeSessionVehicleAuto,
			activeSessionVehicleTrailer,
			refreshSession,
			setActiveTab,
			showToast,
			translations,
		],
	);
}
