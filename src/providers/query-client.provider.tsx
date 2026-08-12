'use client';

import {
	QueryClient,
	type QueryClientConfig,
	QueryClientProvider as TanStackQueryClientProvider,
} from '@tanstack/react-query';
import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

type QueryProviderProps = {
	children: React.ReactNode;
	defaultConfig?: QueryClientConfig;
};

const QueryContext = createContext<
	| {
			queryClient: QueryClient;
			resetQueryClient: () => void;
	  }
	| undefined
>(undefined);

export function QueryProvider({
	children,
	defaultConfig = {
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 10, // 10 minutes
				retry: 1,
				refetchOnWindowFocus: false,
			},
		},
	},
	...props
}: QueryProviderProps) {
	const [queryClient] = useState(() => new QueryClient(defaultConfig));

	const value = useMemo(
		() => ({
			queryClient,
			resetQueryClient: () => {
				queryClient.clear();
			},
		}),
		[queryClient],
	);

	return (
		<QueryContext.Provider {...props} value={value}>
			<TanStackQueryClientProvider client={queryClient}>
				{children}
			</TanStackQueryClientProvider>
		</QueryContext.Provider>
	);
}

export const useQueryClientContext = () => {
	const context = useContext(QueryContext);

	if (context === undefined) {
		throw new Error(
			'useQueryClientContext must be used within a QueryProvider',
		);
	}

	return context;
};
