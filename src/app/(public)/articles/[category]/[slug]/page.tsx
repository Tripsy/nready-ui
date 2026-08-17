import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Icons } from '@/components/icon.component';
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
	ARTICLE_CATEGORY_FALLBACK_SLUG,
	type ArticleContentType,
	type ArticleModel,
	getArticlePrimaryCategory,
} from '@/models/article.model';
import { showImage } from '@/models/image.model';
import { requestPublicArticle } from '@/services/article.service';
import type { Language } from '@/types/common.type';

// An article changes on an editorial rhythm, not per request, so the read is served from
// Next's data cache. Same window as the listing, so a freshly published article does not
// appear in one and 404 from the other for long.
const REVALIDATE_SECONDS = 600;

const TRANSLATION_PREFIX = 'articles';

const TRANSLATION_KEYS = [
	'text.back_to_list',
	'text.by',
	'text.restricted',
	'text.unavailable',
	'text.source',
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
	params: Promise<{ category: string; slug: string }>;
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
	const { category: categorySlug, slug } = await props.params;
	const language = await getLanguage();

	const [translations, result] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
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

	const category = getArticlePrimaryCategory(entry, language);

	/*
	 * The category segment is part of the address but not part of the lookup — the article
	 * slug alone identifies it. So a link built before the article was re-filed still
	 * resolves, and is sent on to the address it has now rather than 404ing or serving the
	 * same article under two URLs.
	 */
	const canonicalCategory = category?.slug ?? ARTICLE_CATEGORY_FALLBACK_SLUG;

	if (categorySlug !== canonicalCategory) {
		redirect(
			Routes.get('article-view', {
				category: canonicalCategory,
				slug: content.slug,
			}),
		);
	}

	const authorName = content.author?.name ?? entry.author?.name ?? null;
	const publishedAt = formatRelativeDate(entry.publish_at);

	return (
		<div className="container-default py-12 md:py-16">
			<article className="mx-auto max-w-3xl">
				<BackToList label={translations['text.back_to_list']} />

				{category && (
					// Its own row: `BackToList` is an inline link, so the chip would
					// otherwise sit beside it rather than above the title.
					<div className="mt-6">
						<Link
							href={Routes.get('articles-category', {
								category: category.slug,
							})}
							className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
						>
							{category.label}
						</Link>
					</div>
				)}

				<h1 className="mt-3 text-3xl md:text-4xl font-semibold">
					{content.title}
				</h1>

				<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
					{publishedAt && (
						<span className="flex items-center gap-1.5">
							<Icons.Calendar className="opacity-40" />
							<time dateTime={String(entry.publish_at)}>
								{publishedAt}
							</time>
						</span>
					)}

					{authorName && (
						<span className="flex items-center gap-1.5">
							<Icons.User className="opacity-40" />
							{translations['text.by']} {authorName}
						</span>
					)}
				</div>

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
						className="mt-8 aspect-16/9 w-full rounded-2xl object-cover"
						sizes="(min-width: 768px) 768px, 100vw"
					/>
				)}

				{content.brief && (
					<p className="mt-6 text-lg text-muted">{content.brief}</p>
				)}

				{/*
				 * The stored value is markdown. `renderMarkdownServer` sanitizes it, which is
				 * what makes the injection safe; it runs here rather than on the client so the
				 * body is in the HTML a crawler receives.
				 */}
				<div
					className="markdown-body mt-8"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdownServer`
					dangerouslySetInnerHTML={{
						__html: renderMarkdownServer(content.content),
					}}
				/>

				{entry.source && (entry.source.label || entry.source.url) && (
					<footer className="mt-10 border-t border-border pt-6 text-sm text-muted">
						<p>
							{translations['text.source']}:{' '}
							{entry.source.url ? (
								<a
									href={entry.source.url}
									target="_blank"
									rel="noopener noreferrer nofollow"
									className="hover:text-foreground transition-colors"
								>
									{entry.source.label || entry.source.url}
								</a>
							) : (
								entry.source.label
							)}
						</p>

						{entry.source.disclaimer && (
							<p className="mt-2 italic">
								{entry.source.disclaimer}
							</p>
						)}
					</footer>
				)}
			</article>
		</div>
	);
}
