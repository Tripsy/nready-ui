import type { Metadata } from 'next';
import { ArticleFeed } from '@/app/(public)/_components/article/article-feed.component';
import {
	ARTICLE_LIST_TRANSLATION_KEYS,
	ARTICLE_PAGE_SIZE,
	FeaturedArticles,
	loadFeaturedArticles,
	loadPublicArticles,
} from '@/app/(public)/_components/article/article-list.component';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { Configuration } from '@/config/settings.config';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';

const TRANSLATION_PREFIX = 'articles';

const TRANSLATION_KEYS = [
	'text.heading',
	...ARTICLE_LIST_TRANSLATION_KEYS,
] as const;

export async function generateMetadata(): Promise<Metadata> {
	const [title, description] = await Promise.all([
		translate(`${TRANSLATION_PREFIX}.meta.title`, {
			app_name: Configuration.get('app.name'),
		}),
		translate(`${TRANSLATION_PREFIX}.meta.description`),
	]);

	return { title, description };
}

export default async function Page() {
	const language = await getLanguage();

	const [translations, page, featured] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		loadPublicArticles({ language }),
		loadFeaturedArticles(language),
	]);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb items={[{ label: translations['text.heading'] }]} />

				<FeaturedArticles
					entries={featured}
					language={language}
					heading={translations['text.featured']}
				/>

				<ArticleFeed
					initialEntries={page?.entries ?? null}
					initialTotal={page?.total ?? 0}
					pageSize={ARTICLE_PAGE_SIZE}
					language={language}
					translations={translations}
				/>
			</div>
		</div>
	);
}
