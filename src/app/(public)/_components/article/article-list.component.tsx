import Link from 'next/link';
import { ArticleHeading } from '@/app/(public)/_components/article/article-feed.component';
import { getResponseData } from '@/helpers/api.helper';
import { logger } from '@/helpers/logger.helper';
import {
	type ArticleFeaturedStatus,
	ArticleFeaturedStatusEnum,
	type ArticleModel,
	buildArticlePath,
	getArticleContentProp,
} from '@/models/article.model';
import { requestPublicArticles } from '@/services/article.service';
import type { Language } from '@/types/common.type';

/**
 * One page of the feed. The infinite scroll asks for the next page with the same size, so
 * this is the step the reader advances by rather than a hard ceiling.
 */
export const ARTICLE_PAGE_SIZE = 12;

// Published articles change on an editorial rhythm, not per request, so the first page is
// served from Next's data cache and refreshed every ten minutes. Later pages are fetched by
// the browser and cached by TanStack Query instead.
const REVALIDATE_SECONDS = 600;

/** How many cards the featured block holds — one full row of the three-column grid. */
const FEATURED_LIMIT = 3;

export const ARTICLE_LIST_TRANSLATION_KEYS = [
	'text.no_entries',
	'text.unavailable',
	'text.featured',
	'text.loading_more',
	'text.spotlight',
	'text.latest',
] as const;

export type ArticleListTranslations = Record<
	(typeof ARTICLE_LIST_TRANSLATION_KEYS)[number],
	string
>;

/**
 * The first page of the feed, plus the total the pager needs to know when to stop.
 *
 * `null` means the backend could not be reached — told apart from an empty feed, which is a
 * legitimate answer and reads very differently to a visitor.
 */
export async function loadPublicArticles(params: {
	language: Language;
	category_id?: number;
	featured_status?: ArticleFeaturedStatus;
	limit?: number;
}): Promise<{ entries: ArticleModel[]; total: number } | null> {
	try {
		const response = await requestPublicArticles({
			...params,
			limit: params.limit ?? ARTICLE_PAGE_SIZE,
			revalidate: REVALIDATE_SECONDS,
		});

		if (!response?.success) {
			return null;
		}

		const data = getResponseData(response);

		return {
			entries: data?.entries ?? [],
			total: data?.pagination?.total ?? data?.entries.length ?? 0,
		};
	} catch (error) {
		logger.error('Failed to load the public article list', error, {
			category_id: params.category_id,
		});

		return null;
	}
}

/**
 * Loads the featured slot: the articles flagged for the section, newest first.
 */
export async function loadFeaturedArticles(
	language: Language,
): Promise<ArticleModel[] | null> {
	const result = await loadPublicArticles({
		language,
		featured_status: ArticleFeaturedStatusEnum.SECTION,
		limit: FEATURED_LIMIT,
	});

	return result?.entries ?? null;
}

/**
 * The featured slot: a three-column card block above the feed.
 *
 * Text only — the cards are a shortcut to a handful of articles, and the covers are what the
 * feed below already leads with. The same articles stay in that feed rather than being
 * lifted out of it, so a reader scrolling the list still meets them in date order.
 */
export function FeaturedArticles({
	entries,
	language,
	heading,
}: {
	entries: ArticleModel[] | null;
	language: Language;
	heading: string;
}) {
	if (!entries?.length) {
		return null;
	}

	return (
		<section className="mt-10">
			<h2 className="text-xs uppercase tracking-wide text-muted">
				{heading}
			</h2>

			<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{entries.map((entry) => {
					const brief = getArticleContentProp(
						entry,
						language,
						'brief',
						'',
					);
					const href = buildArticlePath(entry, language);

					return (
						<article
							key={entry.id}
							className="flex flex-col rounded-2xl border border-border bg-surface p-6"
						>
							<ArticleHeading
								entry={entry}
								language={language}
								level="compact"
							/>

							{brief && (
								<p className="mt-3 text-sm text-muted">
									{href ? (
										<Link
											href={href}
											className="hover:underline"
										>
											{brief}
										</Link>
									) : (
										brief
									)}
								</p>
							)}
						</article>
					);
				})}
			</div>
		</section>
	);
}
