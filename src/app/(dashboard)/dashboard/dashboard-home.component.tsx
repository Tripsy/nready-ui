'use client';

import {
	ArrowUpRight,
	BanknoteArrowDown,
	DollarSign,
	FileText,
	Hourglass,
	type LucideIcon,
} from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { ActiveWorkSessions } from '@/app/(dashboard)/_components/stats/active-work-sessions';
import { CountCMRs } from '@/app/(dashboard)/_components/stats/count-cmrs';
import { CountDriverCMRs } from '@/app/(dashboard)/_components/stats/count-driver-cmrs';
import { CountDriverWorkingHours } from '@/app/(dashboard)/_components/stats/count-driver-working-hours';
import { CountWorkingHours } from '@/app/(dashboard)/_components/stats/count-working-hours';
import { DriverMonthlyReport } from '@/app/(dashboard)/_components/stats/driver-monthly-report.component';
import { LatestCMRs } from '@/app/(dashboard)/_components/stats/latest-cmrs';
import { RecentActivity } from '@/app/(dashboard)/_components/stats/recent-activity';
import { SumExpenses } from '@/app/(dashboard)/_components/stats/sum-expenses';
import { SumRevenues } from '@/app/(dashboard)/_components/stats/sum-revenues';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { isDriver } from '@/models/auth.model';
import { useAuth } from '@/providers/auth.provider';

// Shared card shell for a single stat box (title + icon header, value body).
function StatCard({
	title,
	icon: Icon,
	children,
}: {
	title: string;
	icon: LucideIcon;
	children: ReactNode;
}) {
	return (
		<Card className="card-hover">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium text-muted">
					{title}
				</CardTitle>
				<Icon className="h-4 w-4 text-muted" />
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

// Drivers only see their own CMR count and working hours — the admin-scoped
// stats (expenses/revenues/activity feeds) are gated by policy in the backend.
function DriverDashboard(): JSX.Element {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
			<StatCard title="CMRs" icon={FileText}>
				<CountDriverCMRs />
			</StatCard>
			<StatCard title="Working Hours" icon={Hourglass}>
				<CountDriverWorkingHours />
			</StatCard>
		</div>
	);
}

function AdminDashboard(): JSX.Element {
	return (
		<>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
				<StatCard title="CMRs" icon={FileText}>
					<CountCMRs />
				</StatCard>
				<StatCard title="Working Hours" icon={Hourglass}>
					<CountWorkingHours />
				</StatCard>
				<StatCard title="Expenses" icon={BanknoteArrowDown}>
					<SumExpenses />
				</StatCard>
				<StatCard title="Revenues" icon={DollarSign}>
					<SumRevenues />
				</StatCard>
			</div>

			<Card className="my-6">
				<CardHeader>
					<CardTitle>Reports</CardTitle>
				</CardHeader>
				<CardContent>
					<DriverMonthlyReport />
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="space-y-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle>Work Sessions</CardTitle>
							<Link
								variant="ghost"
								size="sm"
								className="gap-1"
								href={Routes.get('work-session')}
							>
								View more <ArrowUpRight className="h-4 w-4" />
							</Link>
						</CardHeader>
						<CardContent>
							<ActiveWorkSessions />
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle>Latest CMRs</CardTitle>
							<Link
								variant="ghost"
								size="sm"
								className="gap-1"
								href={Routes.get('cmr')}
							>
								View more <ArrowUpRight className="h-4 w-4" />
							</Link>
						</CardHeader>
						<CardContent>
							<LatestCMRs />
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle>Recent Activity</CardTitle>
						<Link
							variant="ghost"
							size="sm"
							className="gap-1"
							href={Routes.get('log-history')}
						>
							View more <ArrowUpRight className="h-4 w-4" />
						</Link>
					</CardHeader>
					<CardContent>
						<RecentActivity />
					</CardContent>
				</Card>
			</div>
		</>
	);
}

export function DashboardHome(): JSX.Element {
	const { auth } = useAuth();

	// `auth` is SSR-injected (see providers.tsx), so the correct dashboard renders
	// on the first paint — no admin/driver flash.
	return isDriver(auth) ? <DriverDashboard /> : <AdminDashboard />;
}
