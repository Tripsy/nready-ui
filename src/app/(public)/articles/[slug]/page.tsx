import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
	ARTICLE_AUTHOR_TRANSLATION_KEYS,
	ArticleAuthor,
} from '@/app/(public)/_components/article/article-author.component';
import { ArticleRating } from '@/app/(public)/_components/article/article-rating.component';
import {
	ARTICLE_SHARE_TRANSLATION_KEYS,
	ArticleShare,
} from '@/app/(public)/_components/article/article-share.component';
import {
	ARTICLE_SIDEBAR_TRANSLATION_KEYS,
	ArticleSidebar,
} from '@/app/(public)/_components/article/article-sidebar.component';
import {
	ARTICLE_SOURCE_TRANSLATION_KEYS,
	ArticleSource,
	hasArticleSourceDetails,
} from '@/app/(public)/_components/article/article-source.component';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import {
	COMMENT_TRANSLATION_KEYS,
	COMMENT_TRANSLATION_PREFIX,
} from '@/components/comment/comment.definition';
import { CommentThread } from '@/components/comment/comment-thread.component';
import {
	COMPLAINT_ARTICLE_REASONS,
	COMPLAINT_TRANSLATION_KEYS,
	COMPLAINT_TRANSLATION_PREFIX,
} from '@/components/complaint/complaint.definition';
import { ComplaintReport } from '@/components/complaint/complaint-report.component';
import { Icons } from '@/components/icon.component';
import {
	RATING_TRANSLATION_KEYS,
	RATING_TRANSLATION_PREFIX,
} from '@/components/rating/rating.definition';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';
import { ApiError } from '@/exceptions/api.error';
import { getResponseData } from '@/helpers/api.helper';
import { formatRelativeDate } from '@/helpers/date.helper';
import { logger } from '@/helpers/logger.helper';
import { renderMarkdownServer } from '@/helpers/markdown-server.helper';
import {
	ARTICLE_DEFAULT_SETTINGS,
	type ArticleContentType,
	type ArticleModel,
	getArticlePrimaryCategory,
} from '@/models/article.model';
import { CommentEntityTypeEnum } from '@/models/comment.model';
import { ComplaintEntityTypeEnum } from '@/models/complaint.model';
import { showImage } from '@/models/image.model';
import { requestPublicArticle } from '@/services/article.service';
import type { Language } from '@/types/common.type';

// An article changes on an editorial rhythm, not per request, so the read is served from
// Next's data cache. Same window as the listing, so a freshly published article does not
// appear in one and 404 from the other for long.
const REVALIDATE_SECONDS = 600;

const TRANSLATION_PREFIX = 'articles';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.back_to_list',
	'text.restricted',
	'text.unavailable',
	...ARTICLE_AUTHOR_TRANSLATION_KEYS,
	// Listed here rather than imported: `ArticleRating` is a client module, whose value
	// exports are client references by the time this one reads them.
	'text.rating',
	'text.rating_up',
	'text.rating_down',
	'text.rating_failed',
	...ARTICLE_SHARE_TRANSLATION_KEYS,
	...ARTICLE_SIDEBAR_TRANSLATION_KEYS,
	...ARTICLE_SOURCE_TRANSLATION_KEYS,
] as const;

/**
 * What the fetch produced, as the page has to render it: the article, the closed door, or the
 * backend being unreachable. A missing article is not in here — that one is `notFound()`,
 * which never returns.
 */
type ArticleResult =
	| { status: 'ok'; entry: ArticleModel }
	/** The visibility rule refused this (anonymous) reader; `message` is the backend's wording. */
	| { status: 'restricted'; message: string }
	| { status: 'unavailable' };

type Props = {
	params: Promise<{ slug: string }>;
};

async function getArticle(
	slug: string,
	language: Language,
): Promise<ArticleResult> {
	try {
		const response = await requestPublicArticle({
			slug,
			language,
			revalidate: REVALIDATE_SECONDS,
		});

		const entry = getResponseData(response);

		if (!response?.success || !entry) {
			return { status: 'unavailable' };
		}

		return { status: 'ok', entry };
	} catch (error) {
		if (error instanceof ApiError) {
			if (error.status === 404) {
				notFound();
			}

			// 401 (sign-in required) and 403 (everything else the rule checks) both mean the
			// article exists and this reader may not have it.
			if (error.status === 401 || error.status === 403) {
				return { status: 'restricted', message: error.message };
			}
		}

		logger.error('Failed to load the public article', error, { slug });

		return { status: 'unavailable' };
	}
}

/**
 * The public read returns a single translation (the language is an INNER join), so the body
 * is whatever came back rather than a lookup across languages.
 */
function getContent(entry: ArticleModel): ArticleContentType | undefined {
	return entry.contents?.[0];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { slug } = await props.params;
	const language = await getLanguage();
	const result = await getArticle(slug, language);

	if (result.status !== 'ok') {
		return {
			title: await translate('app.page.not_found', {
				app_name: Configuration.get('app.name'),
			}),
		};
	}

	const content = getContent(result.entry);

	return {
		title: content?.meta?.title || content?.title,
		description: content?.meta?.description || content?.brief,
		keywords: content?.meta?.keywords,
	};
}

function BackToList({ label }: { label: string }) {
	return (
		<Link
			href={Routes.get('articles')}
			className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
		>
			<Icons.Direction.ArrowLeft />
			{label}
		</Link>
	);
}

export default async function Page(props: Props) {
	const { slug } = await props.params;
	const language = await getLanguage();

	const [
		translations,
		commentTranslations,
		ratingTranslations,
		complaintTranslations,
		result,
	] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		translateBatch(COMMENT_TRANSLATION_KEYS, COMMENT_TRANSLATION_PREFIX),
		translateBatch(RATING_TRANSLATION_KEYS, RATING_TRANSLATION_PREFIX),
		translateBatch(
			COMPLAINT_TRANSLATION_KEYS,
			COMPLAINT_TRANSLATION_PREFIX,
		),
		getArticle(slug, language),
	]);

	if (result.status !== 'ok') {
		return (
			<div className="container-default py-12 md:py-16">
				<div className="mx-auto max-w-3xl">
					<BackToList label={translations['text.back_to_list']} />

					<p className="mt-10 text-muted">
						{result.status === 'restricted'
							? result.message || translations['text.restricted']
							: translations['text.unavailable']}
					</p>
				</div>
			</div>
		);
	}

	const { entry } = result;
	const content = getContent(entry);

	if (!content) {
		// Published with no translation the reader can be served — nothing to render.
		notFound();
	}

	/*
	 * Read for the breadcrumb and the sidebar's "more from this category" only — the address
	 * carries no category segment, so re-filing an article never changes its URL.
	 */
	const category = getArticlePrimaryCategory(entry, language);

	const articlePath = Routes.get('article-view', { slug: content.slug });

	/*
	 * The by-line the article carries, falling back to the account that filed it — which has
	 * a name and nothing else, so the box then reads as a bare attribution.
	 */
	const author = content.author?.name
		? content.author
		: entry.author?.name
			? { name: entry.author.name }
			: null;

	const publishedAt = formatRelativeDate(entry.publish_at);

	// `read` returns the tag links without the term itself, so ids are all there is — which
	// is exactly what the listing filter takes.
	const tagIds = (entry.tags ?? []).map((link) => link.tag_id);

	/*
	 * What this article accepts from its readers. The API resolves the three against its own
	 * defaults before returning them, so the fallback only covers a response from an older
	 * backend — one that does not send `settings` at all.
	 */
	const settings = entry.settings ?? ARTICLE_DEFAULT_SETTINGS;

	return (
		<div className="container-default py-12 md:py-16">
			<Breadcrumb
				items={[
					{
						label: translations['text.heading'],
						href: Routes.get('articles'),
					},
					...(category
						? [
								{
									label: category.label,
									href: Routes.get('articles-category', {
										slug: category.slug,
									}),
								},
							]
						: []),
					{ label: content.title },
				]}
			/>

			<div className="mt-6 flex flex-col gap-10 lg:flex-row lg:gap-12">
				{/*
				 * `min-w-0` so a wide code block or table scrolls inside the column
				 * rather than pushing the sidebar out of the row.
				 */}
				<article className="min-w-0 flex-1">
					<h1 className="text-3xl md:text-4xl font-semibold">
						{content.title}
					</h1>

					<div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm text-muted">
						{publishedAt ? (
							<span className="flex items-center gap-1.5">
								<Icons.Calendar className="opacity-40" />
								<time dateTime={String(entry.publish_at)}>
									{publishedAt}
								</time>
							</span>
						) : (
							// Holds the left half of the row so the share links stay on
							// the right when an article carries no publish date.
							<span />
						)}

						<ArticleShare
							path={articlePath}
							title={content.title}
							translations={translations}
						/>
					</div>

					{content.brief && (
						<p className="mt-6 text-lg font-semibold text-muted">
							{content.brief}
						</p>
					)}

					{entry.cover_image && (
						<Image
							src={showImage(
								entry.cover_image.path,
								entry.cover_image.storage,
							)}
							width={entry.cover_image.properties?.width ?? 1200}
							height={entry.cover_image.properties?.height ?? 675}
							alt=""
							priority
							className="mt-6 aspect-16/9 w-full rounded-2xl object-cover"
							sizes="(min-width: 1024px) 800px, 100vw"
						/>
					)}

					{/*
					 * The stored value is markdown. `renderMarkdownServer` sanitizes it,
					 * which is what makes the injection safe; it runs here rather than on
					 * the client so the body is in the HTML a crawler receives.
					 */}
					<div
						className="markdown-body mt-8"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdownServer`
						dangerouslySetInnerHTML={{
							__html: renderMarkdownServer(content.content),
						}}
					/>

					{/*
					 * Below the body and above the by-line: the reader has just finished
					 * the article, which is the only moment either question makes sense.
					 * Both are client-rendered — the counts, the reader's own vote and
					 * their own report are resolved per visitor, and this page is served
					 * from a 600s data cache.
					 *
					 * The two sit at opposite ends of one row: the rating is the answer
					 * the article asks for, the report the exception to it.
					 */}
					{(settings.allow_rating || settings.allow_complaints) && (
						<section className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
							{settings.allow_rating && (
								<ArticleRating
									articleId={entry.id}
									translations={translations}
								/>
							)}

							{settings.allow_complaints && (
								<ComplaintReport
									entityType={ComplaintEntityTypeEnum.ARTICLE}
									entityId={entry.id}
									reasons={COMPLAINT_ARTICLE_REASONS}
									translations={complaintTranslations}
								/>
							)}
						</section>
					)}

					{/*
					 * After the by-line and the source, which belong to the article itself:
					 * the discussion is about it and reads as a separate section, not as
					 * part of the piece. Client-rendered for the same reason the rating is —
					 * this page is served from a 600s data cache, and a comment approved in
					 * the meantime would not appear until that window passed.
					 */}
					{author && (
						<ArticleAuthor
							name={author.name}
							email={author.email}
							avatar={author.avatar}
							description={author.description}
							translations={translations}
						/>
					)}

					{hasArticleSourceDetails(entry.source) && (
						<ArticleSource
							source={entry.source}
							translations={translations}
						/>
					)}

					{settings.allow_comments && (
						<CommentThread
							entityType={CommentEntityTypeEnum.ARTICLE}
							entityId={entry.id}
							translations={commentTranslations}
							ratingTranslations={ratingTranslations}
							complaintTranslations={complaintTranslations}
						/>
					)}
				</article>

				<ArticleSidebar
					language={language}
					articleId={entry.id}
					tagIds={tagIds}
					categoryId={category?.id}
					translations={translations}
				/>
			</div>
		</div>
	);
}
