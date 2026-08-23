import Link from 'next/link';
import { loadPublicArticles } from '@/app/(public)/_components/article/article-list.component';
import { formatRelativeDate } from '@/helpers/date.helper';
import {
	type ArticleModel,
	buildArticlePath,
	getArticleContentProp,
} from '@/models/article.model';
import type { Language } from '@/types/common.type';

export const ARTICLE_SIDEBAR_TRANSLATION_KEYS = [
	'text.similar_articles',
	'text.latest_articles',
] as const;

export type ArticleSidebarTranslations = Record<
	(typeof ARTICLE_SIDEBAR_TRANSLATION_KEYS)[number],
	string
>;

/** How many rows each box holds — enough to be useful, short enough to stay a sidebar. */
const SIDEBAR_LIMIT = 5;

function ArticleSidebarBox({
	heading,
	entries,
	language,
}: {
	heading: string;
	entries: ArticleModel[];
	language: Language;
}) {
	return (
		<section className="rounded-2xl border border-border bg-surface p-6">
			<h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
				{heading}
			</h2>

			<ul className="mt-4 space-y-4">
				{entries.map((entry) => {
					const href = buildArticlePath(entry, language);
					const title = getArticleContentProp(
						entry,
						language,
						'title',
					);
					const publishedAt = formatRelativeDate(entry.publish_at);

					return (
						<li key={entry.id}>
							{/*
							 * An article with no slug in this language has no address to
							 * point at, so it reads as plain text rather than a link
							 * that 404s.
							 */}
							{href ? (
								<Link
									href={href}
									className="text-sm font-medium hover:text-accent transition-colors"
								>
									{title}
								</Link>
							) : (
								<span className="text-sm font-medium">
									{title}
								</span>
							)}

							{publishedAt && (
								<p className="mt-1 text-xs text-muted">
									<time dateTime={String(entry.publish_at)}>
										{publishedAt}
									</time>
								</p>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
}

/**
 * The article page's right-hand column: what else to read, from two angles.
 *
 * - *Similar articles* — anything sharing a tag with this one, which is the loosest
 *   relation the data carries and so the one most likely to return something.
 * - *Latest articles* — the rest of this article's category, newest first.
 *
 * Both exclude the article being read, and a box that comes back empty (or whose backend
 * call fails) renders nothing at all rather than an empty heading. With no tags and no
 * category there is nothing to ask for and the whole column disappears — which is why the
 * caller lays it out as a sibling that may render `null`.
 *
 * The two reads are issued together; they are independent and each is served from Next's
 * data cache.
 */
export async function ArticleSidebar({
	language,
	articleId,
	tagIds,
	categoryId,
	translations,
}: {
	language: Language;
	articleId: number;
	tagIds: number[];
	categoryId?: number;
	translations: ArticleSidebarTranslations;
}) {
	const [similar, latest] = await Promise.all([
		tagIds.length
			? loadPublicArticles({
					language,
					tag_id: tagIds,
					exclude_id: articleId,
					limit: SIDEBAR_LIMIT,
				})
			: null,
		categoryId
			? loadPublicArticles({
					language,
					category_id: categoryId,
					exclude_id: articleId,
					// Over-fetched, because the rows already shown as similar are dropped
					// below and the box would otherwise come up short.
					limit: SIDEBAR_LIMIT * 2,
				})
			: null,
	]);

	const similarEntries = similar?.entries ?? [];
	const similarIds = new Set(similarEntries.map((entry) => entry.id));

	// The two boxes are different questions with one answer set, so an article tagged like
	// this one and filed under the same category qualifies for both. It is listed once, in
	// the box that says more about why it is there.
	const latestEntries = (latest?.entries ?? [])
		.filter((entry) => !similarIds.has(entry.id))
		.slice(0, SIDEBAR_LIMIT);

	if (!similarEntries.length && !latestEntries.length) {
		return null;
	}

	return (
		<aside className="w-full shrink-0 lg:w-80">
			<div className="flex flex-col gap-6 lg:sticky lg:top-24">
				{similarEntries.length > 0 && (
					<ArticleSidebarBox
						heading={translations['text.similar_articles']}
						entries={similarEntries}
						language={language}
					/>
				)}

				{latestEntries.length > 0 && (
					<ArticleSidebarBox
						heading={translations['text.latest_articles']}
						entries={latestEntries}
						language={language}
					/>
				)}
			</div>
		</aside>
	);
}
