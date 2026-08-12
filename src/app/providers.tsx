import { headers } from 'next/headers';
import type React from 'react';
import { logger } from '@/helpers/logger.helper';
import type { AuthModel } from '@/models/auth.model';
import { AriaRouterProvider } from '@/providers/aria-router.provider';
import { AuthProvider } from '@/providers/auth.provider';
import { QueryProvider } from '@/providers/query-client.provider';
import { ThemeProvider } from '@/providers/theme.provider';
import { ToastProvider } from '@/providers/toast.provider';

export async function Providers({ children }: { children: React.ReactNode }) {
	const headersList = await headers();
	const authHeader = headersList.get('x-auth-data');

	let initAuth: AuthModel | null = null;

	try {
		initAuth = authHeader ? JSON.parse(authHeader) : null;
	} catch (error: unknown) {
		logger.error('Failed to parse the x-auth-data header', error);
	}

	return (
		<ThemeProvider>
			<ToastProvider>
				<QueryProvider>
					<AuthProvider initAuth={initAuth}>
						<AriaRouterProvider>{children}</AriaRouterProvider>
					</AuthProvider>
				</QueryProvider>
			</ToastProvider>
		</ThemeProvider>
	);
}
