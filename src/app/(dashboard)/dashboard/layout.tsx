import Link from 'next/link';
import type { ReactNode } from 'react';
import { Breadcrumb } from '@/app/(dashboard)/_components/breadcrumb.component';
import DashboardMain from '@/app/(dashboard)/_components/dashboard-main.component';
import { SideMenu } from '@/app/(dashboard)/_components/side-menu.component';
import { SideMenuToggle } from '@/app/(dashboard)/_components/side-menu-toggle.component';
import { DashboardProvider } from '@/app/(dashboard)/_providers/dashboard.provider';
import { LogoComponent } from '@/components/layout/logo.default';
import { ToggleTheme } from '@/components/layout/toggle-theme';
import { UserMenu } from '@/components/layout/user-menu.component';
import ProtectedRoute from '@/components/protected-route.component';
import { WindowContainer } from '@/components/window/window-container.component';
import Routes, { RouteAuthEnum } from '@/config/routes.setup';
import { translateBatch } from '@/config/translate.setup';
import {
	LAYOUT_TRANSLATION_KEYS,
	type LayoutTranslations,
} from '@/types/layout.type';

function Header({ translations }: { translations: LayoutTranslations }) {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container-dashboard mx-4">
				<div className="flex items-center h-16 gap-2">
					<SideMenuToggle />
					<Link
						href={Routes.get('home')}
						className="flex items-center gap-2"
					>
						<LogoComponent />
					</Link>

					<div className="md:pl-12">
						<Breadcrumb />
					</div>

					<div className="flex items-center gap-2 ml-auto">
						<ToggleTheme translations={translations} />
						<UserMenu translations={translations} />
					</div>
				</div>
			</div>
		</header>
	);
}

export default async function Layout({ children }: { children: ReactNode }) {
	const translations = await translateBatch(LAYOUT_TRANSLATION_KEYS);

	return (
		<DashboardProvider>
			<div className="dashboard-layout min-h-screen bg-background">
				<Header translations={translations} />
				<ProtectedRoute routeAuth={RouteAuthEnum.PROTECTED}>
					<DashboardMain>
						<SideMenu />
						<div className="container-dashboard">
							<Breadcrumb />
							{children}
							<WindowContainer section="dashboard" />
						</div>
					</DashboardMain>
				</ProtectedRoute>
			</div>
		</DashboardProvider>
	);
}
