'use client';

import { useQuery } from '@tanstack/react-query';
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { stringToDate } from '@/helpers/date.helper';
import { logRejection } from '@/helpers/logger.helper';
import { isDriver } from '@/models/auth.model';
import type { CashFlowModel } from '@/models/cash-flow.model';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import { VehicleTypeEnum } from '@/models/vehicle.model';
import type { WorkSessionModel } from '@/models/work-session.model';
import {
	type WorkSessionVehicleModel,
	WorkSessionVehicleStatusEnum,
} from '@/models/work-session-vehicle.model';
import { useAuth } from '@/providers/auth.provider';
import {
	requestActiveWorkSession,
	requestAvailableCompanyVehicles,
	requestSessionCashFlowEntries,
} from '@/services/driver-session.service';
import type { WorkSessionType } from '@/types/auth.type';

type SessionSituation =
	| 'loading'
	| 'active'
	| 'missing'
	| 'not-applicable'
	| 'error';

type WorkSessionContextType = {
	activeTab: string;
	setActiveTab: (tab: string) => void;
	sessionSituation: SessionSituation;
	activeSession: WorkSessionModel | null;
	activeSessionVehicles: WorkSessionVehicleModel[];
	activeSessionVehicleAuto: CompanyVehicleModel | null;
	activeSessionVehicleTrailer: CompanyVehicleModel | null;
	availableCompanyVehicles: CompanyVehicleModel[];
	workSessionCmrs: CmrSessionModel[];
	refreshSession: () => Promise<void>;
	sessionCashFlowEntries: CashFlowModel[];
	refetchSessionCashFlowEntries: () => Promise<void>;
};

const REFRESH_INTERVAL_SESSION = 10 * 60 * 1000; // 10 minutes
const REFRESH_INTERVAL_AVAILABLE_COMPANY_VEHICLES = 20 * 60 * 1000; // 20 minutes
const REFRESH_INTERVAL_SESSION_PAYMENTS = 20 * 60 * 1000; // 20 minutes

const WorkSessionContext = createContext<WorkSessionContextType | undefined>(
	undefined,
);

function getSessionSituation(
	auth: ReturnType<typeof useAuth>['auth'],
	isLoading: boolean,
	isError: boolean,
	workSession: WorkSessionModel | null,
): SessionSituation {
	if (!isDriver(auth)) {
		return 'not-applicable';
	}

	if (isLoading) {
		return 'loading';
	}

	// Only surface an error when there's no cached session to fall back on;
	// otherwise keep showing the last-known session rather than an error screen.
	if (isError && !workSession) {
		return 'error';
	}

	return workSession ? 'active' : 'missing';
}

const WorkSessionProvider = ({
	children,
	initSession,
}: {
	children: ReactNode;
	initSession?: WorkSessionType;
}) => {
	const { auth } = useAuth();

	const [activeTab, setActiveTab] = useState('sessionVehicles');

	const {
		data: sessionData,
		isLoading: isSessionDataLoading,
		isError: isSessionDataError,
		refetch: refetchSession,
	} = useQuery({
		queryKey: ['work-session', auth?.id],
		queryFn: () => requestActiveWorkSession(),
		enabled: isDriver(auth),
		initialData: initSession,
		staleTime: REFRESH_INTERVAL_SESSION,
	});

	const {
		data: availableCompanyVehicles,
		refetch: refetchAvailableCompanyVehicles,
	} = useQuery({
		queryKey: ['company-vehicle', 'available', auth?.id],
		queryFn: () => requestAvailableCompanyVehicles(),
		enabled: isDriver(auth),
		staleTime: REFRESH_INTERVAL_AVAILABLE_COMPANY_VEHICLES,
	});

	const {
		data: sessionCashFlowEntries,
		refetch: refetchSessionCashFlowEntries,
	} = useQuery({
		queryKey: ['cash-flow', 'session', sessionData?.workSession?.id],
		queryFn: () => {
			if (!auth?.id) {
				throw new Error('No auth');
			}

			const date = sessionData?.workSession?.created_at;
			const createAtStart = date
				? typeof date === 'string'
					? stringToDate(date)
					: date
				: null;

			return requestSessionCashFlowEntries({
				user_id: auth.id,
				create_at_start: createAtStart,
			});
		},
		enabled: isDriver(auth) && !!sessionData?.workSession?.created_at,
		staleTime: REFRESH_INTERVAL_SESSION_PAYMENTS,
	});

	const sessionSituation = getSessionSituation(
		auth,
		isSessionDataLoading,
		isSessionDataError,
		sessionData?.workSession ?? null,
	);

	const sessionRefreshingRef = useRef(false);

	const refreshSession = useCallback(async () => {
		if (sessionRefreshingRef.current) {
			return;
		}

		try {
			sessionRefreshingRef.current = true;

			await refetchSession();
			await refetchAvailableCompanyVehicles();
		} catch {
			// Error surfaces via query state
		} finally {
			sessionRefreshingRef.current = false;
		}
	}, [refetchSession, refetchAvailableCompanyVehicles]);

	useEffect(() => {
		// Interval-based refresh — runs regardless of visibility
		const intervalId = setInterval(() => {
			refreshSession().catch(
				logRejection('Background work-session refresh failed'),
			);
		}, REFRESH_INTERVAL_SESSION);

		// Tab visibility refresh — only refresh if tab was hidden long enough
		let hiddenAt: number | null = null;
		const HIDDEN_THRESHOLD = 5 * 60 * 1000; // only refresh if hidden for 5+ minutes

		const refreshIfVisible = () => {
			if (document.visibilityState === 'hidden') {
				hiddenAt = Date.now();
				return;
			}

			if (hiddenAt && Date.now() - hiddenAt > HIDDEN_THRESHOLD) {
				refreshSession().catch(
					logRejection('Background work-session refresh failed'),
				);
			}

			hiddenAt = null;
		};

		document.addEventListener('visibilitychange', refreshIfVisible);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener('visibilitychange', refreshIfVisible);
		};
	}, [refreshSession]);

	const contextValue = useMemo(() => {
		const activeSessionVehicleAuto =
			sessionData?.workSessionVehicles.find(
				(s) =>
					s.company_vehicle.vehicle.vehicle_type ===
						VehicleTypeEnum.AUTO &&
					s.status === WorkSessionVehicleStatusEnum.ASSIGNED,
			)?.company_vehicle ?? null;

		const activeSessionVehicleTrailer =
			sessionData?.workSessionVehicles.find(
				(s) =>
					s.company_vehicle.vehicle.vehicle_type ===
						VehicleTypeEnum.TRAILER &&
					s.status === WorkSessionVehicleStatusEnum.ASSIGNED,
			)?.company_vehicle ?? null;

		return {
			activeTab,
			setActiveTab,
			sessionSituation,
			activeSession: sessionData?.workSession ?? null,
			activeSessionVehicles: sessionData?.workSessionVehicles ?? [],
			activeSessionVehicleAuto,
			activeSessionVehicleTrailer,
			availableCompanyVehicles: availableCompanyVehicles ?? [],
			workSessionCmrs: sessionData?.workSessionCmrs ?? [],
			refreshSession,
			sessionCashFlowEntries: sessionCashFlowEntries ?? [],
			refetchSessionCashFlowEntries: async () => {
				await refetchSessionCashFlowEntries();
			},
		};
	}, [
		activeTab,
		sessionSituation,
		sessionData,
		availableCompanyVehicles,
		refreshSession,
		sessionCashFlowEntries,
		refetchSessionCashFlowEntries,
	]);

	return (
		<WorkSessionContext.Provider value={contextValue}>
			{children}
		</WorkSessionContext.Provider>
	);
};

function useWorkSession() {
	const context = useContext(WorkSessionContext);

	if (context === undefined) {
		throw new Error(
			'useWorkSession must be used within a WorkSessionProvider',
		);
	}

	return context;
}

export { useWorkSession, WorkSessionContext, WorkSessionProvider };
