import Routes from '@/config/routes.setup';
import { getResponseData } from '@/helpers/api.helper';
import type { ArticleModel } from '@/models/article.model';
import type { CommentEntityType } from '@/models/comment.model';
import { CommentEntityTypeEnum } from '@/models/comment.model';
import { requestPublicArticles } from '@/services/article.service';
import type { FindFunctionResponseType } from '@/types/action.type';
import type { Language } from '@/types/common.type';

/**
 * Where the page carrying a target's discussion lives, as a path this app can link to - or null
 * when the target cannot be reached: it is gone, it is not public, or nothing here renders it yet.
 */
type CommentTargetResolver = (
	entityId: number,
	language: Language,
) => Promise<string | null>;

/**
 * An article's canonical address, resolved by id.
 *
 * Through the public listing, so the reader only ever lands on an article they may see: one that is
 * unpublished, or restricted and unlisted, is absent from it and resolves to nothing. The category
 * segment is cosmetic - the article page redirects to the canonical one if it has moved - but it is
 * built correctly here rather than left to that redirect.
 */
async function resolveArticleTarget(
	entityId: number,
	language: Language,
): Promise<string | null> {
	const response = await requestPublicArticles({
		id: entityId,
		language,
		limit: 1,
	});

	const entry =
		getResponseData<FindFunctionResponseType<ArticleModel>>(response)
			?.entries?.[0];

	const content = entry?.contents?.[0];

	if (!entry || !content) {
		return null;
	}

	return Routes.get('article-view', { slug: content.slug });
}

/**
 * How a comment target becomes a page, one entry per kind of thing that can be commented on.
 *
 * The registry is what keeps `/comments/:id` agnostic: the backend accepts a polymorphic target and
 * says only what type it is, so the mapping from that type to a URL belongs here - in one place -
 * rather than as a branch inside the page. Adding reviews, or anything else that grows a comment
 * thread, is an entry in this map and nothing else.
 *
 * `Partial` on purpose: `CommentEntityTypeEnum` mirrors the backend, which already accepts targets
 * this app has no page for. An unresolvable type answers null, which the caller renders as a 404 -
 * the right answer for a link to a page that does not exist here.
 */
const COMMENT_TARGET_RESOLVERS: Partial<
	Record<CommentEntityType, CommentTargetResolver>
> = {
	[CommentEntityTypeEnum.ARTICLE]: resolveArticleTarget,
};

export async function resolveCommentTargetPath(
	entityType: CommentEntityType,
	entityId: number,
	language: Language,
): Promise<string | null> {
	const resolver = COMMENT_TARGET_RESOLVERS[entityType];

	if (!resolver) {
		return null;
	}

	return resolver(entityId, language);
}
