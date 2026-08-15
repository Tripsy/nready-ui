import { Configuration } from '@/config/settings.config';
import type { Language } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

export const ArticleStatusEnum = {
	DRAFT: 'draft',
	PENDING: 'pending',
	REJECTED: 'rejected',
	SCHEDULED: 'scheduled',
	PUBLISHED: 'published',
	ARCHIVED: 'archived',
} as const;

export type ArticleStatus =
	(typeof ArticleStatusEnum)[keyof typeof ArticleStatusEnum];

export const ArticleLayoutEnum = {
	DEFAULT: 'default',
} as const;

export type ArticleLayout =
	(typeof ArticleLayoutEnum)[keyof typeof ArticleLayoutEnum];

export const ArticleFeaturedStatusEnum = {
	SECTION: 'section',
	CATEGORY: 'category',
} as const;

export type ArticleFeaturedStatus =
	(typeof ArticleFeaturedStatusEnum)[keyof typeof ArticleFeaturedStatusEnum];

export const ArticleVisibilityEnum = {
	PUBLIC: 'public',
	RESTRICTED: 'restricted',
} as const;

export type ArticleVisibility =
	(typeof ArticleVisibilityEnum)[keyof typeof ArticleVisibilityEnum];

export const ArticleSourceModeEnum = {
	INPUT: 'input',
	PARSED: 'parsed',
} as const;

export type ArticleSourceMode =
	(typeof ArticleSourceModeEnum)[keyof typeof ArticleSourceModeEnum];

export type ArticleAuthorType = {
	name: string;
	email?: string;
	avatar?: string;
	description?: string;
};

export type ArticleSourceType = {
	label?: string;
	url?: string;
	disclaimer?: string;
	about?: string;
};

/**
 * `content` carries **markdown**, which is what the form edits and what the backend stores; the
 * dashboard renders it to HTML for display only (`renderMarkdown`).
 *
 * `find` does not select `content`, so a list row arrives without it — anything reading the body
 * has to come from `read`.
 */
export type ArticleContentType = {
	language: Language;
	slug: string;
	title: string;
	brief: string | null;
	content?: string;
	author?: ArticleAuthorType | null;
	meta: PageMeta;
};

/**
 * Only present while `visibility` is `restricted`; the stored password hash is never sent, so
 * `password` exists on the form values but never on a value read back from the API.
 */
export type ArticleVisibilityRuleType = {
	requires_auth: boolean;
	/*
	 * A flag, not a plan list: the backend's access policy only ever proved the reader held
	 * *an* active subscription, so plan identifiers promised a gate nothing enforced.
	 */
	requires_subscription: boolean;
	allowed_countries: string[] | null;
	/*
	 * Defaults to true and is not editable from the dashboard — every article is listed unless
	 * something outside this form says otherwise. Kept on the type because the API still
	 * returns it.
	 */
	is_listed: boolean;
};

export const ARTICLE_DEFAULT_LAYOUT = ArticleLayoutEnum.DEFAULT;
export const ARTICLE_DEFAULT_VISIBILITY = ArticleVisibilityEnum.PUBLIC;

export type ArticleModel<D = Date | string> = {
	id: number;
	status: ArticleStatus;
	layout?: ArticleLayout;
	publish_at: D | null;
	archive_at: D | null;
	featured_status: ArticleFeaturedStatus | null;
	featured_order: number;
	visibility: ArticleVisibility;
	public_at?: D | null;
	source_mode: ArticleSourceMode;
	source?: ArticleSourceType | null;
	details?: Record<string, string | number | boolean> | null;

	// Relations
	author_id: number | null;
	author?: { id: number; name: string; email?: string } | null;
	contents?: ArticleContentType[];
	/** Link rows, not the categories themselves — `read` selects only the foreign key. */
	categories?: { category_id: number }[];
	tags?: { tag_id: number }[];
	visibility_rule?: ArticleVisibilityRuleType | null;

	// Timestamps
	created_at: D;
	updated_at: D;
	deleted_at: D;
};

// Helpers
/**
 * The wording carried by a row, falling back through the default language and then whatever
 * translation exists — `find` returns only the filtered language, so an article with no content
 * there arrives with none at all.
 */
export function getArticleContentProp(
	entry: ArticleModel,
	language: Language,
	prop: keyof Pick<ArticleContentType, 'title' | 'slug' | 'brief'> = 'title',
	fallback: string = '[no content]',
): string {
	if (!entry.contents?.length) {
		return fallback;
	}

	const contentSelected = entry.contents.find(
		(content) => content.language === language,
	);

	if (contentSelected?.[prop]) {
		return contentSelected[prop];
	}

	const contentDefault = entry.contents.find(
		(content) => content.language === Configuration.defaultLanguage(),
	);

	if (contentDefault?.[prop]) {
		return contentDefault[prop];
	}

	return entry.contents[0][prop] ?? fallback;
}

/** Window titles and confirmation lists. */
export const displayArticleLabel = (
	entry: ArticleModel,
	language: Language,
): string => {
	return `#${entry.id} ${getArticleContentProp(entry, language)}`;
};
