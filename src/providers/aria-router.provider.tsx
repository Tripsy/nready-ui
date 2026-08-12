'use client';

import { RouterProvider } from '@heroui/react/rac';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wires react-aria's client-side navigation (used by HeroUI components that take an
 * `href` — menu items, links, etc.) to the Next.js router, so those navigations are
 * client-side rather than full page loads.
 */
export function AriaRouterProvider({ children }: { children: ReactNode }) {
	const router = useRouter();

	return (
		<RouterProvider navigate={(href) => router.push(href)}>
			{children}
		</RouterProvider>
	);
}
