import type { Metadata } from 'next';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { ProductFeed } from '@/app/(public)/_components/product/product-feed.component';
import {
	loadPublicProducts,
	PRODUCT_LIST_TRANSLATION_KEYS,
	PRODUCT_PAGE_SIZE,
	PRODUCT_SEARCH_MIN_LENGTH,
} from '@/app/(public)/_components/product/product-list';
import { ProductSearch } from '@/app/(public)/_components/product/product-search.component';
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
	'text.search_placeholder',
	'text.search_submit',
	'text.search_clear',
	...PRODUCT_LIST_TRANSLATION_KEYS,
] as const;

type PageProps = {
	searchParams: Promise<{ term?: string | string[] }>;
};

/**
 * `rawTerm` is what the visitor typed, kept for the input. `term` is what may be sent: only a
 * term long enough for the backend to accept, otherwise the request would 400.
 */
async function readTerm(
	searchParams: PageProps['searchParams'],
): Promise<{ rawTerm: string; term: string | undefined }> {
	const { term: value } = await searchParams;
	const rawTerm = (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

	return {
		rawTerm,
		term: rawTerm.length >= PRODUCT_SEARCH_MIN_LENGTH ? rawTerm : undefined,
	};
}

export async function generateMetadata({
	searchParams,
}: PageProps): Promise<Metadata> {
	const [title, description, { rawTerm }] = await Promise.all([
		translate(`${TRANSLATION_PREFIX}.meta.title`, {
			app_name: Configuration.get('app.name'),
		}),
		translate(`${TRANSLATION_PREFIX}.meta.description`),
		readTerm(searchParams),
	]);

	// A result page is a thin, unbounded duplicate of the catalog - kept out of the index, while
	// the product links on it are still followed.
	return {
		title,
		description,
		...(rawTerm !== '' && { robots: { index: false, follow: true } }),
	};
}

export default async function Page({ searchParams }: PageProps) {
	const [language, { rawTerm, term }] = await Promise.all([
		getLanguage(),
		readTerm(searchParams),
	]);

	const [translations, page, noResults, termTooShort] = await Promise.all([
		translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
		loadPublicProducts({ language, term }),
		term
			? translate(`${TRANSLATION_PREFIX}.text.no_results`, { term })
			: undefined,
		rawTerm !== '' && !term
			? translate(`${TRANSLATION_PREFIX}.text.term_too_short`, {
					min: PRODUCT_SEARCH_MIN_LENGTH,
				})
			: undefined,
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

				<ProductSearch
					defaultValue={rawTerm}
					minLength={PRODUCT_SEARCH_MIN_LENGTH}
					translations={{
						placeholder: translations['text.search_placeholder'],
						submit: translations['text.search_submit'],
						clear: translations['text.search_clear'],
					}}
				/>

				{termTooShort && (
					<p className="mt-3 text-sm text-muted">{termTooShort}</p>
				)}

				<ProductFeed
					key={term ?? ''}
					initialEntries={page?.entries ?? null}
					initialTotal={page?.total ?? 0}
					pageSize={PRODUCT_PAGE_SIZE}
					language={language}
					term={term}
					emptyMessage={noResults}
					translations={translations}
				/>
			</div>
		</div>
	);
}
