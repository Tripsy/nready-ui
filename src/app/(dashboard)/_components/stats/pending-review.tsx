'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import NextLink from 'next/link';
import { type JSX, useState } from 'react';
import {
	PanelBody,
	PanelRow,
} from '@/app/(dashboard)/_components/stats/panel.component';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/components/ui/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Routes from '@/config/routes.setup';
import { getLanguageClient } from '@/config/translate.setup';
import { timeAgo } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { ComplaintReasonEnum } from '@/models/complaint.model';
import {
	PENDING_REVIEW_ENTITIES,
	type PendingReviewEntity,
	type PendingReviewEntry,
	requestStatsPendingReview,
} from '@/services/stats.service';

const TRANSLATION_KEYS = [
	'dashboard.text.failed_to_load_items_awaiting_review',
	'dashboard.text.view_more',
	'dashboard.labels.user',
	'dashboard.labels.client',
	'dashboard.labels.article',
	'dashboard.labels.comment',
	'dashboard.labels.complaint',
	'dashboard.text.waiting_for_review',
	'dashboard.text.no_pending_review',
	...enumTranslationKeys('complaint.reason', ComplaintReasonEnum),
] as const;

/**
 * `complaint` sends a reason enum (`hate_speech`), which wants formatting; every other label is
 * free text - a user's name, a comment's body - that formatting would mangle. `article` sends
 * none at all, its title being per-language in `article_content`, so the id stands in.
 */
function displayLabel(
	entity: PendingReviewEntity,
	entry: PendingReviewEntry,
	translations: Readonly<Record<string, string>>,
): string {
	if (!entry.label) {
		return `#${entry.id}`;
	}

	return entity === 'complaint'
		? translateEnumLabel(translations, 'complaint.reason', entry.label)
		: entry.label;
}

export function PendingReview(): JSX.Element {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const [tab, setTab] = useState<PendingReviewEntity>('user');

	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'pending-review'],
		queryFn: () => requestStatsPendingReview(),
		// A moderation queue is worth seeing promptly, like the other health panels.
		staleTime: 60 * 1000,
	});

	return (
		<Card>
			{/* No CardHeader - the tab strip is the heading, so the top padding is restored here. */}
			<CardContent className="p-6">
				<Tabs
					selectedKey={tab}
					onSelectionChange={(key) =>
						setTab(key as PendingReviewEntity)
					}
					className="w-full"
				>
					<TabsList>
						{PENDING_REVIEW_ENTITIES.map((entity) => {
							const total = data?.[entity].total ?? 0;

							return (
								<TabsTrigger key={entity} id={entity}>
									{translations[`dashboard.labels.${entity}`]}
									{total > 0 && (
										// Neutral, not danger: a backlog is work to do, not a
										// failure - the card title already says what it is.
										<span className="ml-1.5 rounded-full bg-default px-1.5 text-xs text-default-foreground">
											{total}
											<span className="sr-only">
												{' '}
												{
													translations[
														'dashboard.text.waiting_for_review'
													]
												}
											</span>
										</span>
									)}
								</TabsTrigger>
							);
						})}
					</TabsList>

					{PENDING_REVIEW_ENTITIES.map((entity) => {
						const group = data?.[entity];

						return (
							<TabsContent key={entity} id={entity}>
								<div className="pt-4">
									<div className="flex flex-row items-center justify-end mb-4">
										<Link
											variant="ghost"
											size="sm"
											className="gap-1"
											href={Routes.get(entity)}
										>
											{
												translations[
													'dashboard.text.view_more'
												]
											}
											<ArrowUpRight className="h-4 w-4" />
										</Link>
									</div>

									<PanelBody
										isLoading={isLoading}
										isError={isError}
										isEmpty={
											!group || group.entries.length === 0
										}
										errorText={
											translations[
												'dashboard.text.failed_to_load_items_awaiting_review'
											]
										}
										emptyText={
											translations[
												'dashboard.text.no_pending_review'
											]
										}
									>
										{group?.entries.map((entry) => (
											<PanelRow
												key={entry.id}
												aside={timeAgo(
													entry.created_at,
													getLanguageClient(),
												)}
											>
												<NextLink
													href={Routes.get(entity)}
													className="font-medium truncate block hover:underline"
												>
													{displayLabel(
														entity,
														entry,
														translations,
													)}
												</NextLink>
												{/* Only when the title is a real label -
												    otherwise the title already *is* the id. */}
												{entry.label ? (
													<span className="text-sm text-muted">
														#{entry.id}
													</span>
												) : null}
											</PanelRow>
										))}
									</PanelBody>
								</div>
							</TabsContent>
						);
					})}
				</Tabs>
			</CardContent>
		</Card>
	);
}
