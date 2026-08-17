import Image from 'next/image';
import { Icons } from '@/components/icon.component';
import { isOptimizableImageSrc } from '@/models/image.model';

export const ARTICLE_AUTHOR_TRANSLATION_KEYS = [
	'text.about_the_author',
] as const;

export type ArticleAuthorTranslations = Record<
	(typeof ARTICLE_AUTHOR_TRANSLATION_KEYS)[number],
	string
>;

const AVATAR_SIZE = 56;

/**
 * The by-line box closing an article.
 *
 * `name` is the only field an article is guaranteed to carry — the backend requires it on the
 * author object, and an article with no object of its own falls back to the account that
 * filed it, which has nothing but a name. Everything else is optional and simply drops out.
 *
 * The avatar is free text on the API (a URL the editor pastes), so it is served unoptimized
 * unless it resolves to a host this app already proxies — next/image would otherwise refuse a
 * remote host that is not in `remotePatterns`.
 */
export function ArticleAuthor({
	name,
	email,
	avatar,
	description,
	translations,
}: {
	name: string;
	email?: string;
	avatar?: string;
	description?: string;
	translations: ArticleAuthorTranslations;
}) {
	return (
		<section className="mt-10 rounded-2xl border border-border bg-surface p-6">
			<h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
				{translations['text.about_the_author']}
			</h2>

			<div className="mt-4 flex items-start gap-4">
				{avatar ? (
					<Image
						src={avatar}
						width={AVATAR_SIZE}
						height={AVATAR_SIZE}
						alt=""
						unoptimized={!isOptimizableImageSrc(avatar)}
						className="h-14 w-14 shrink-0 rounded-full object-cover"
					/>
				) : (
					<span
						aria-hidden="true"
						className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground"
					>
						<Icons.User size={24} />
					</span>
				)}

				<div className="min-w-0">
					<p className="font-medium">{name}</p>

					{email && (
						<a
							href={`mailto:${email}`}
							className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
						>
							<Icons.Email size={14} className="opacity-40" />
							{email}
						</a>
					)}

					{description && (
						<p className="mt-2 text-sm text-muted">{description}</p>
					)}
				</div>
			</div>
		</section>
	);
}
