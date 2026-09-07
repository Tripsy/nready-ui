'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useEffect, useRef } from 'react';
import Routes from '@/config/routes.setup';
import { getResponseData } from '@/helpers/api.helper';
import { cn } from '@/helpers/css.helper';
import { formatRelativeDate } from '@/helpers/date.helper';
import {
	ArticleFeaturedStatusEnum,
	type ArticleModel,
	buildArticlePath,
	getArticleContentProp,
	getArticlePrimaryCategory,
} from '@/models/article.model';
import { showImage } from '@/models/image.model';
import { requestPublicArticlesPage } from '@/services/article.service';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { Language } from '@/types/common.type';

/**
 * Fallback box for the cover, so a row without one keeps the same rhythm as its neighbors
 * rather than letting the text run the full width.
 */
const COVER_WIDTH = 320;
const COVER_HEIGHT = 180;

/**
 * The category an article is filed under, as a link to that category's page. One component
 * because the feed and the featured cards must not drift into two different chips.
 */
function CategoryChip({
	category,
}: {
	category: NonNullable<ReturnType<typeof getArticlePrimaryCategory>>;
}) {
	return (
		<Link
			href={Routes.get('articles-category', { slug: category.slug })}
			className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
		>
			{category.label}
		</Link>
	);
}

/**
 * The wording and links a row needs, resolved once. The lead block, the secondary items and
 * the feed rows all read the same fields, and deriving them in three places is how two of
 * them end up disagreeing.
 */
function resolveArticleView(entry: ArticleModel, language: Language) {
	return {
		title: getArticleContentProp(entry, language, 'title'),
		brief: getArticleContentProp(entry, language, 'brief', ''),
		category: getArticlePrimaryCategory(entry, language),
		href: buildArticlePath(entry, language),
		publishedAt: formatRelativeDate(entry.publish_at),
	};
}

/** Date above, category inline with the heading - the shape every article block shares. */
export function ArticleHeading({
	entry,
	language,
	level,
}: {
	entry: ArticleModel;
	language: Language;
	level: 'lead' | 'row' | 'compact';
}) {
	const { title, category, href, publishedAt } = resolveArticleView(
		entry,
		language,
	);

	const titleClassName = {
		lead: 'text-2xl md:text-3xl font-semibold',
		row: 'text-xl md:text-2xl font-semibold',
		compact: 'text-base font-semibold',
	}[level];

	return (
		<>
			{publishedAt && (
				// The relative form is measured against *now*, which moves between the
				// server render and hydration (the page is cached for minutes), so the two
				// can legitimately disagree at a boundary. The absolute form is pinned to
				// `app.timezone` and matches exactly; see `formatRelativeDate`.
				<time
					dateTime={String(entry.publish_at)}
					className="text-xs text-muted"
					suppressHydrationWarning
				>
					{publishedAt}
				</time>
			)}

			{/*
			 * The category rides on the title's line rather than above it, so a block reads
			 * as one heading. `flex-wrap` lets the chip drop to its own line when the title
			 * is long, which is the only shape that survives a narrow viewport.
			 */}
			<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
				{category && <CategoryChip category={category} />}

				<h3 className={titleClassName}>
					{href ? (
						<Link href={href} className="hover:underline">
							{title}
						</Link>
					) : (
						title
					)}
				</h3>
			</div>
		</>
	);
}

function ArticleCover({
	entry,
	href,
}: {
	entry: ArticleModel;
	href: string | null;
}) {
	if (!entry.cover_image) {
		return null;
	}

	const image = (
		<Image
			src={showImage(entry.cover_image.path, entry.cover_image.storage)}
			// The stored dimensions are the real ones; `next/image` needs them to reserve
			// the space, and the CSS below is what actually sizes the box.
			width={entry.cover_image.properties?.width ?? COVER_WIDTH}
			height={entry.cover_image.properties?.height ?? COVER_HEIGHT}
			// Decorative: the title next to it already names the article, and the alt would
			// only repeat it to a screen reader.
			alt=""
			className="aspect-16/9 w-full rounded-2xl object-cover"
			sizes="(min-width: 768px) 320px, 100vw"
		/>
	);

	if (!href) {
		return image;
	}

	return (
		// Repeats the title's destination, so it is hidden from assistive tech and skipped
		// by the tab order rather than announced twice.
		<Link href={href} aria-hidden="true" tabIndex={-1} className="block">
			{image}
		</Link>
	);
}

/** How many articles the lead block holds: one large, five beside it. */
const LEAD_BLOCK_SIZE = 6;

/**
 * The head of the listing: the newest article on a panel of its own with its cover, and the
 * next five stacked beside it with thumbnails.
 *
 * Only the lead is boxed. The background plus the larger cover is what ranks it above the
 * five, which stay plain so the block reads as one lead and its followers.
 */
function ArticleLeadBlock({
	entries,
	language,
}: {
	entries: ArticleModel[];
	language: Language;
}) {
	const [lead, ...secondary] = entries;
	const leadView = resolveArticleView(lead, language);

	return (
		<div className="grid gap-8 md:grid-cols-2 md:gap-10">
			<article className="bg-surface-secondary p-6">
				{lead.cover_image && (
					<div className="mb-4">
						<ArticleCover entry={lead} href={leadView.href} />
					</div>
				)}

				<ArticleHeading entry={lead} language={language} level="lead" />

				{leadView.brief && (
					<p className="mt-3 text-muted">
						{leadView.href ? (
							<Link
								href={leadView.href}
								className="hover:underline"
							>
								{leadView.brief}
							</Link>
						) : (
							leadView.brief
						)}
					</p>
				)}
			</article>

			<div className="flex flex-col">
				{secondary.map((entry, index) => {
					const { href } = resolveArticleView(entry, language);

					return (
						<article
							key={entry.id}
							className={cn(
								'flex items-start gap-4',
								index > 0 && 'mt-6 border-t border-border pt-6',
							)}
						>
							<div className="flex-1">
								<ArticleHeading
									entry={entry}
									language={language}
									level="compact"
								/>
							</div>

							{entry.cover_image && (
								// Deliberately small: the lead's cover is what ranks it
								// above these three, and a matching thumbnail here would
								// flatten that back out.
								<div className="w-24 shrink-0 sm:w-28">
									<ArticleCover entry={entry} href={href} />
								</div>
							)}
						</article>
					);
				})}
			</div>
		</div>
	);
}

/** One feed row: text on the left, cover on the right when the article has one. */
function ArticleRow({
	entry,
	language,
}: {
	entry: ArticleModel;
	language: Language;
}) {
	const { brief, href } = resolveArticleView(entry, language);
	const isFeatured =
		entry.featured_status === ArticleFeaturedStatusEnum.SECTION;

	return (
		<article
			className={cn(
				'flex flex-col gap-6 md:flex-row md:items-center md:gap-10',
				isFeatured && 'bg-surface-secondary p-6 md:p-8',
			)}
		>
			<div className="flex-1">
				<ArticleHeading entry={entry} language={language} level="row" />

				{brief && (
					<p className="mt-3 text-muted">
						{href ? (
							<Link href={href} className="hover:underline">
								{brief}
							</Link>
						) : (
							brief
						)}
					</p>
				)}
			</div>

			{entry.cover_image && (
				<div className="md:w-80 md:shrink-0">
					<ArticleCover entry={entry} href={href} />
				</div>
			)}
		</article>
	);
}

export type ArticleFeedTranslations = {
	'text.no_entries': string;
	'text.unavailable': string;
	'text.loading_more': string;
	'text.spotlight': string;
	'text.latest': string;
};

/** Section label, matching the one above the featured cards. */
function SectionHeading({ children }: { children: string }) {
	return (
		<h2 className="text-xs uppercase tracking-wide text-muted">
			{children}
		</h2>
	);
}

/**
 * The public article feed, shared by `/articles` and a single category's page.
 *
 * The first page is rendered on the server and handed over as `initialEntries`, so the feed
 * is in the HTML a crawler reads and the first paint needs no fetch. Later pages are pulled
 * in as the reader reaches the end of the list - through the proxy, since this runs in the
 * browser and only the proxy may talk to the backend from there.
 */
export function ArticleFeed({
	initialEntries,
	initialTotal,
	pageSize,
	language,
	categoryId,
	translations,
}: {
	initialEntries: ArticleModel[] | null;
	initialTotal: number;
	pageSize: number;
	language: Language;
	categoryId?: number;
	translations: ArticleFeedTranslations;
}) {
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	const query = useInfiniteQuery({
		queryKey: ['articles', 'feed', categoryId ?? null, language],
		queryFn: async ({ pageParam }) => {
			const response = await requestPublicArticlesPage({
				language,
				category_id: categoryId,
				page: pageParam,
				limit: pageSize,
			});

			const data = getResponseData(response);

			if (!response?.success || !data) {
				throw new Error('Could not retrieve the article list');
			}

			return data;
		},
		initialPageParam: 1,
		// The server already fetched page one; refetching it on mount would duplicate every
		// row for a moment and waste the request the page just made.
		initialData: initialEntries
			? {
					pages: [
						{
							entries: initialEntries,
							pagination: {
								page: 1,
								limit: pageSize,
								total: initialTotal,
							},
						} as FindFunctionResponseType<ArticleModel>,
					],
					pageParams: [1],
				}
			: undefined,
		getNextPageParam: (lastPage, pages) => {
			const total = lastPage.pagination?.total ?? 0;
			const loaded = pages.reduce(
				(count, page) => count + page.entries.length,
				0,
			);

			return loaded < total ? pages.length + 1 : undefined;
		},
		enabled: initialEntries !== null,
	});

	const entries = query.data?.pages.flatMap((page) => page.entries) ?? [];

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

	useEffect(() => {
		const sentinel = sentinelRef.current;

		if (!sentinel || !hasNextPage) {
			return;
		}

		/*
		 * `rootMargin` starts the fetch before the sentinel is actually on screen, so the
		 * next rows are usually there by the time the reader arrives. The observer is
		 * rebuilt whenever `hasNextPage` flips, which is also what disconnects it at the
		 * end of the list.
		 */
		const observer = new IntersectionObserver(
			(observed) => {
				if (observed[0]?.isIntersecting && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ rootMargin: '400px 0px' },
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (initialEntries === null || query.isError) {
		return (
			<p className="mt-10 text-muted">
				{translations['text.unavailable']}
			</p>
		);
	}

	if (entries.length === 0) {
		return (
			<p className="mt-10 text-muted">
				{translations['text.no_entries']}
			</p>
		);
	}

	// The block needs its full complement to read as one: with fewer, every article stays a
	// row and the listing simply looks shorter.
	const hasLeadBlock = entries.length >= LEAD_BLOCK_SIZE;
	const leadEntries = hasLeadBlock ? entries.slice(0, LEAD_BLOCK_SIZE) : [];
	const rowEntries = hasLeadBlock ? entries.slice(LEAD_BLOCK_SIZE) : entries;

	return (
		<div className="mt-10">
			{hasLeadBlock && (
				<>
					<SectionHeading>
						{translations['text.spotlight']}
					</SectionHeading>

					<div className="mt-4">
						<ArticleLeadBlock
							entries={leadEntries}
							language={language}
						/>
					</div>
				</>
			)}

			{rowEntries.length > 0 && (
				<div className={cn(hasLeadBlock && 'mt-10')}>
					<SectionHeading>
						{translations['text.latest']}
					</SectionHeading>
				</div>
			)}

			{rowEntries.map((entry, index) => (
				<Fragment key={entry.id}>
					{index > 0 ? (
						<hr className="mx-auto my-8 w-[90%] border-t border-border" />
					) : (
						<div className="mt-4" />
					)}

					<ArticleRow entry={entry} language={language} />
				</Fragment>
			))}

			{/* Watched by the observer above; sits below the last row on purpose. */}
			<div ref={sentinelRef} aria-hidden="true" className="h-px" />

			{isFetchingNextPage && (
				<p className="mt-8 text-center text-sm text-muted">
					{translations['text.loading_more']}
				</p>
			)}
		</div>
	);
}
