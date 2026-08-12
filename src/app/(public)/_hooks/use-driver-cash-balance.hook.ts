import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isDriver } from '@/models/auth.model';
import { useAuth } from '@/providers/auth.provider';
import { requestDriverCashBalance } from '@/services/driver-session.service';
import type { Currency } from '@/types/common.type';

const REFRESH_INTERVAL_CASH_BALANCE = 1000 * 60 * 30; // 30 minutes

export function useDriverCashBalance(currency: Currency) {
	const { auth } = useAuth();
	const queryClient = useQueryClient();
	const userId = auth?.id;

	const query = useQuery({
		queryKey: ['driver-cash-balance', userId, currency],
		queryFn: async () => {
			if (!userId) {
				throw new Error('No auth');
			}

			return requestDriverCashBalance(userId, currency);
		},
		enabled: isDriver(auth) && !!userId,
		staleTime: REFRESH_INTERVAL_CASH_BALANCE,
	});

	// Invalidates every currency balance for the user in one call — a cash-flow
	// change can affect any currency, so all are refreshed rather than tracking
	// which one moved. Prefix match covers the per-currency `[..., currency]` keys.
	const invalidateAll = useCallback(() => {
		return queryClient.invalidateQueries({
			queryKey: ['driver-cash-balance', userId],
		});
	}, [queryClient, userId]);

	return {
		...query,
		invalidateAll,
	};
}
