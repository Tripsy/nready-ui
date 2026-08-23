import Link from 'next/link';
import { Icons } from '@/components/icon.component';
import Routes from '@/config/routes.setup';
import { translateBatch } from '@/config/translate.setup';

const TRANSLATION_PREFIX = 'articles';

const TRANSLATION_KEYS = [
	'text.back_to_list',
	'text.not_found_heading',
	'text.not_found_message',
] as const;

/**
 * What `notFound()` in the article page renders.
 *
 * The boundary is what sets the 404 status as well — without a `not-found.tsx` in the tree
 * Next renders an empty page and answers 200, which tells a crawler the slug is a real page.
 */
export default async function NotFound() {
	const translations = await translateBatch(
		TRANSLATION_KEYS,
		TRANSLATION_PREFIX,
	);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-3xl text-center">
				<h1 className="text-2xl md:text-3xl font-semibold">
					{translations['text.not_found_heading']}
				</h1>
				<p className="mt-2 text-muted">
					{translations['text.not_found_message']}
				</p>

				<Link
					href={Routes.get('articles')}
					className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:gap-2.5 transition-all"
				>
					<Icons.Direction.ArrowLeft />
					{translations['text.back_to_list']}
				</Link>
			</div>
		</div>
	);
}
