'use client';

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useAvailableCmrWebSocket } from '@/app/(public)/_hooks/use-available-cmr-websocket.hook';
import type { CmrModel } from '@/models/cmr.model';
import type { WsStatus } from '@/types/web-socket.type';

type AvailableCmrContextType = {
	entries: CmrModel[];
	wsStatus: WsStatus;
	errorMessage: string | null;
	reconnect: () => void;
};

const AvailableCmrContext = createContext<AvailableCmrContextType | undefined>(
	undefined,
);

/**
 * Owns the single "available CMRs" WebSocket for the whole driver panel. It sits
 * above the tab strip so the connection survives tab switches — mounting it inside
 * the tab panel (react-aria unmounts the inactive panel) tore the socket down and
 * re-established it, with a fresh "connecting" spinner, on every tab tap.
 */
export function AvailableCmrProvider({ children }: { children: ReactNode }) {
	const { entries, wsStatus, errorMessage, manualReconnect } =
		useAvailableCmrWebSocket();

	const value = useMemo<AvailableCmrContextType>(
		() => ({
			entries,
			wsStatus,
			errorMessage,
			reconnect: manualReconnect,
		}),
		[entries, wsStatus, errorMessage, manualReconnect],
	);

	return (
		<AvailableCmrContext.Provider value={value}>
			{children}
		</AvailableCmrContext.Provider>
	);
}

export function useAvailableCmr(): AvailableCmrContextType {
	const context = useContext(AvailableCmrContext);

	if (context === undefined) {
		throw new Error(
			'useAvailableCmr must be used within an AvailableCmrProvider',
		);
	}

	return context;
}
