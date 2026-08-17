import type { ArticleSourceType } from '@/models/article.model';

export const ARTICLE_SOURCE_TRANSLATION_KEYS = [
	'text.source',
	'text.about_the_source',
] as const;

export type ArticleSourceTranslations = Record<
	(typeof ARTICLE_SOURCE_TRANSLATION_KEYS)[number],
	string
>;

/** Whether the attribution carries anything worth a box of its own. */
export function hasArticleSourceDetails(
	source: ArticleSourceType | null | undefined,
): source is ArticleSourceType {
	return Boolean(
		source &&
			(source.label || source.url || source.disclaimer || source.about),
	);
}

/**
 * Attribution for an article this site did not write — a parsed article carries where it came
 * from, a note about the publisher, and whatever disclaimer the licence requires.
 *
 * The outbound link is `nofollow`: the target is a third party the editor named, not an
 * endorsement this site vouches for.
 */
export function ArticleSource({
	source,
	translations,
}: {
	source: ArticleSourceType;
	translations: ArticleSourceTranslations;
}) {
	return (
		<section className="mt-6 rounded-2xl border border-border bg-surface p-6">
			<h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
				{translations['text.about_the_source']}
			</h2>

			{(source.label || source.url) && (
				<p className="mt-4 text-sm">
					{translations['text.source']}:{' '}
					{source.url ? (
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer nofollow"
							className="underline hover:text-foreground transition-colors"
						>
							{source.label || source.url}
						</a>
					) : (
						source.label
					)}
				</p>
			)}

			{source.about && (
				<p className="mt-2 text-sm text-muted">{source.about}</p>
			)}

			{source.disclaimer && (
				<p className="mt-3 text-xs italic text-muted">
					{source.disclaimer}
				</p>
			)}
		</section>
	);
}
