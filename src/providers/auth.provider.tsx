'use client';

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
import { ApiError } from '@/exceptions/api.error';
import { logRejection } from '@/helpers/logger.helper';
import type { AuthModel } from '@/models/auth.model';
import { getAuth } from '@/services/auth.service';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type AuthContextType = {
	auth: AuthModel | null;
	setAuth: (model: AuthModel | null) => void;
	authStatus: AuthStatus;
	setAuthStatus: (status: AuthStatus) => void;
	refreshAuth: () => Promise<void>;
};

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({
	children,
	initAuth,
}: {
	children: ReactNode;
	initAuth: AuthModel | null;
}) => {
	const [auth, setAuth] = useState<AuthModel | null>(initAuth);
	const [authStatus, setAuthStatus] = useState<AuthStatus>(
		initAuth ? 'authenticated' : 'loading',
	);
	const authRefreshingRef = useRef(false);

	const refreshAuth = useCallback(async ({ silent = false } = {}) => {
		if (authRefreshingRef.current) {
			return;
		}

		try {
			authRefreshingRef.current = true;

			if (!silent) {
				setAuthStatus('loading');
			}

			const authResponse = await getAuth();
			const authData =
				authResponse?.success && authResponse?.data
					? authResponse.data
					: null;

			setAuth(authData);
			setAuthStatus(authData ? 'authenticated' : 'unauthenticated');
		} catch (error: unknown) {
			if (error instanceof ApiError && error.status === 401) {
				setAuthStatus('unauthenticated');
			} else {
				setAuthStatus('error');
			}
		} finally {
			authRefreshingRef.current = false;
		}
	}, []);

	useEffect(() => {
		if (!initAuth) {
			refreshAuth().catch(() => {
				setAuthStatus('error');
			});
		}
	}, [initAuth, refreshAuth]);

	useEffect(() => {
		// Interval-based refresh — runs regardless of visibility
		const intervalId = setInterval(() => {
			refreshAuth({ silent: true }).catch(
				logRejection('Background auth refresh failed'),
			);
		}, REFRESH_INTERVAL);

		// Tab visibility refresh — only refresh if tab was hidden long enough
		let hiddenAt: number | null = null;
		const HIDDEN_THRESHOLD = 5 * 60 * 1000; // only refresh if hidden for 5+ minutes

		const refreshIfVisible = () => {
			if (document.visibilityState === 'hidden') {
				hiddenAt = Date.now();
				return;
			}

			if (hiddenAt && Date.now() - hiddenAt > HIDDEN_THRESHOLD) {
				refreshAuth({ silent: true }).catch(
					logRejection('Background auth refresh failed'),
				);
			}

			hiddenAt = null;
		};

		document.addEventListener('visibilitychange', refreshIfVisible);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener('visibilitychange', refreshIfVisible);
		};
	}, [refreshAuth]);

	const contextValue = useMemo(
		() => ({
			auth,
			setAuth,
			authStatus,
			setAuthStatus,
			refreshAuth,
		}),
		[auth, authStatus, refreshAuth],
	);

	return (
		<AuthContext.Provider value={contextValue}>
			{children}
		</AuthContext.Provider>
	);
};

function useAuth() {
	const context = useContext(AuthContext);

	if (context === undefined) {
		throw new Error('useAuth must be used within a AuthProvider');
	}

	return context;
}

export { AuthContext, AuthProvider, useAuth };
