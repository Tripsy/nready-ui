import type { Metadata } from 'next';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { ProductFeed } from '@/app/(public)/_components/product/product-feed.component';
import {
	loadPublicProducts,
	PRODUCT_LIST_TRANSLATION_KEYS,
	PRODUCT_PAGE_SIZE,
} from '@/app/(public)/_components/product/product-list';
import { Configuration } from '@/config/settings.config';
import {
	getLanguage,
	translate,
	translateBatch,
} from '@/config/translate.setup';

const TRANSLATION_PREFIX = 'products';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.subheading',
	...PRODUCT_LIST_TRANSLATION_KEYS,
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

	const [translations, page] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		loadPublicProducts({ language }),
	]);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb items={[{ label: translations['text.heading'] }]} />

				<h1 className="mt-8 text-2xl md:text-3xl font-semibold">
					{translations['text.heading']}
				</h1>
				<p className="mt-2 text-muted">
					{translations['text.subheading']}
				</p>

				<ProductFeed
					initialEntries={page?.entries ?? null}
					initialTotal={page?.total ?? 0}
					pageSize={PRODUCT_PAGE_SIZE}
					language={language}
					translations={translations}
				/>
			</div>
		</div>
	);
}
