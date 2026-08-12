import type React from 'react';
import { BreadcrumbProvider } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { SideMenuProvider } from '@/app/(dashboard)/_providers/side-menu.provider';

export function DashboardProvider({ children }: { children: React.ReactNode }) {
	return (
		<BreadcrumbProvider>
			<SideMenuProvider>{children}</SideMenuProvider>
		</BreadcrumbProvider>
	);
}
