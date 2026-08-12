'use client';

import {
	ArrowUpRight,
	BanknoteArrowDown,
	DollarSign,
	type LucideIcon,
} from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { RecentActivity } from '@/app/(dashboard)/_components/stats/recent-activity';
import { SumExpenses } from '@/app/(dashboard)/_components/stats/sum-expenses';
import { SumRevenues } from '@/app/(dashboard)/_components/stats/sum-revenues';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';

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

export function DashboardHome(): JSX.Element {
	return (
		<>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
				<StatCard title="Expenses" icon={BanknoteArrowDown}>
					<SumExpenses />
				</StatCard>
				<StatCard title="Revenues" icon={DollarSign}>
					<SumRevenues />
				</StatCard>
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
		</>
	);
}
