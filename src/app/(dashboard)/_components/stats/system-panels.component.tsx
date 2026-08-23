'use client';

import { ArrowUpRight } from 'lucide-react';
import { type JSX, useState } from 'react';
import { useCronHistoryPanel } from '@/app/(dashboard)/_components/stats/cron-history';
import { useMailQueuePanel } from '@/app/(dashboard)/_components/stats/mail-queue';
import { PanelFilters } from '@/app/(dashboard)/_components/stats/panel.component';
import { useLogDataPanel } from '@/app/(dashboard)/_components/stats/recent-logs';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/components/ui/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';

type PanelTabId = 'log-data' | 'mail-queue' | 'cron-history';

/**
 * The three health panels share one card. Each tab's query runs whether or not its panel is
 * showing, because the tab strip badges how many rows the tab's current filter selected — a
 * hidden tab still has to know its own count.
 */
export function SystemPanels(): JSX.Element {
	const [tab, setTab] = useState<PanelTabId>('log-data');

	const logData = useLogDataPanel();
	const mailQueue = useMailQueuePanel();
	const cronHistory = useCronHistoryPanel();

	const tabs = [
		{ id: 'log-data' as const, label: 'Log Data', panel: logData },
		{ id: 'mail-queue' as const, label: 'Mail Queue', panel: mailQueue },
		{
			id: 'cron-history' as const,
			label: 'Cron History',
			panel: cronHistory,
		},
	];

	return (
		<Card>
			{/* No CardHeader — the tab strip is the heading. `CardContent` is `p-6 pt-0` on the
			    assumption a header sits above it, so the top padding is restored here. */}
			<CardContent className="p-6">
				<Tabs
					selectedKey={tab}
					onSelectionChange={(key) => setTab(key as PanelTabId)}
					className="w-full"
				>
					<TabsList>
						{tabs.map(({ id, label, panel }) => (
							<TabsTrigger key={id} id={id}>
								{label}
								{panel.count > 0 && (
									<span
										className={cn(
											'ml-1.5 rounded-full px-1.5 text-xs',
											panel.isAlert
												? 'bg-danger text-white'
												: 'bg-default text-default-foreground',
										)}
									>
										{panel.count}
										<span className="sr-only">
											{' '}
											entries match the current filter
										</span>
									</span>
								)}
							</TabsTrigger>
						))}
					</TabsList>

					{tabs.map(({ id, panel }) => (
						<TabsContent key={id} id={id}>
							<div className="pt-4">
								<PanelFilters
									trailing={
										// Sits on the filter row rather than a card header, and
										// points at whichever list is open.
										<Link
											variant="ghost"
											size="sm"
											className="gap-1"
											href={Routes.get(id)}
										>
											View more
											<ArrowUpRight className="h-4 w-4" />
										</Link>
									}
								>
									{panel.filters}
								</PanelFilters>

								{panel.body}
							</div>
						</TabsContent>
					))}
				</Tabs>
			</CardContent>
		</Card>
	);
}
