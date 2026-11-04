'use client';

import {
	ArrowUpRight,
	BanknoteArrowDown,
	Clock,
	DollarSign,
	type LucideIcon,
} from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { PendingReview } from '@/app/(dashboard)/_components/stats/pending-review';
import { RecentActivity } from '@/app/(dashboard)/_components/stats/recent-activity';
import { RecentCounts } from '@/app/(dashboard)/_components/stats/recent-counts';
import { SumExpenses } from '@/app/(dashboard)/_components/stats/sum-expenses';
import { SumRevenues } from '@/app/(dashboard)/_components/stats/sum-revenues';
import { SystemPanels } from '@/app/(dashboard)/_components/stats/system-panels.component';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { useTranslation } from '@/hooks/use-translation.hook';

const TRANSLATION_KEYS = [
	'dashboard.section.created_in_the_last_24_hours',
	'dashboard.section.expenses',
	'dashboard.section.recent_activity',
	'dashboard.section.revenues',
	'dashboard.text.view_more',
] as const;

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
	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
				<StatCard
					title={translations['dashboard.section.expenses']}
					icon={BanknoteArrowDown}
				>
					<SumExpenses />
				</StatCard>
				<StatCard
					title={translations['dashboard.section.revenues']}
					icon={DollarSign}
				>
					<SumRevenues />
				</StatCard>

				{/* Spans the two remaining columns of the stat row - five figures need the width. */}
				<Card className="sm:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted">
							{
								translations[
									'dashboard.section.created_in_the_last_24_hours'
								]
							}
						</CardTitle>
						<Clock className="h-4 w-4 text-muted" />
					</CardHeader>
					<CardContent>
						<RecentCounts />
					</CardContent>
				</Card>
			</div>

			<div className="mb-6">
				<PendingReview />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle>
							{translations['dashboard.section.recent_activity']}
						</CardTitle>
						<Link
							variant="ghost"
							size="sm"
							className="gap-1"
							href={Routes.get('log-history')}
						>
							{translations['dashboard.text.view_more']}{' '}
							<ArrowUpRight className="h-4 w-4" />
						</Link>
					</CardHeader>
					<CardContent>
						<RecentActivity />
					</CardContent>
				</Card>

				<SystemPanels />
			</div>
		</>
	);
}
