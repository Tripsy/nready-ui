import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleFeed } from '@/app/(public)/_components/article/article-feed.component';
import {
	ARTICLE_LIST_TRANSLATION_KEYS,
	ARTICLE_PAGE_SIZE,
	loadPublicArticles,
} from '@/app/(public)/_components/article/article-list.component';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { resolveCategoryBySlug } from '@/app/(public)/_components/category/category-resolver';
import Routes from '@/config/routes.setup';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';
import { logger } from '@/helpers/logger.helper';
import {
	type CategoryModel,
	CategoryTypeEnum,
	getCategoryContentProp,
} from '@/models/category.model';
import type { Language } from '@/types/common.type';

const TRANSLATION_PREFIX = 'articles';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.category_subheading',
	...ARTICLE_LIST_TRANSLATION_KEYS,
] as const;

type Props = {
	params: Promise<{ slug: string }>;
};

/**
 * `undefined` is a slug nobody publishes under — a 404. `null` is the backend being
 * unreachable, which is a temporary failure and must not be answered with one.
 */
async function getCategory(
	slug: string,
	language: Language,
): Promise<CategoryModel | undefined | null> {
	try {
		return await resolveCategoryBySlug(
			CategoryTypeEnum.ARTICLE,
			slug,
			language,
		);
	} catch (error) {
		logger.error('Failed to resolve the article category', error, { slug });

		return null;
	}
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { slug } = await props.params;
	const language = await getLanguage();
	const category = await getCategory(slug, language);

	if (!category) {
		return {
			title: await translate(`${TRANSLATION_PREFIX}.meta.title`),
		};
	}

	return {
		title: getCategoryContentProp(category, language, 'label'),
		description: getCategoryContentProp(
			category,
			language,
			'description',
			'',
		),
	};
}

export default async function Page(props: Props) {
	const { slug } = await props.params;
	const language = await getLanguage();

	const [translations, category] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		getCategory(slug, language),
	]);

	if (category === undefined) {
		notFound();
	}

	const label = category
		? getCategoryContentProp(category, language, 'label')
		: '';
	const description = category
		? getCategoryContentProp(category, language, 'description', '')
		: '';

	// The category has to resolve before the articles can be asked for: the backend filters
	// them by id, and the URL carries a slug.
	const page = category
		? await loadPublicArticles({ language, category_id: category.id })
		: null;

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb
					items={[
						{
							label: translations['text.heading'],
							href: Routes.get('articles'),
						},
						{ label },
					]}
				/>

				<h1 className="mt-8 text-2xl md:text-3xl font-semibold">
					{label}
				</h1>
				<p className="mt-2 text-muted">
					{description || translations['text.category_subheading']}
				</p>

				<ArticleFeed
					initialEntries={page?.entries ?? null}
					initialTotal={page?.total ?? 0}
					pageSize={ARTICLE_PAGE_SIZE}
					language={language}
					categoryId={category?.id}
					translations={translations}
				/>
			</div>
		</div>
	);
}
