import type { Metadata } from 'next';
import { Icons } from '@/components/icon.component';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

const TRANSLATION_PREFIX = 'products';

const TRANSLATION_KEYS = [
	'text.heading',
	'text.subheading',
	'text.placeholder',
	'text.browse_categories',
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

// Placeholder: the catalog listing has no public endpoint yet, so the page only announces
// itself and points at the categories, which do.
export default async function Page() {
	const translations = await translateBatch(
		TRANSLATION_KEYS,
		TRANSLATION_PREFIX,
	);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-3xl text-center">
				<h1 className="text-2xl md:text-3xl font-semibold">
					{translations['text.heading']}
				</h1>
				<p className="mt-2 text-muted">
					{translations['text.subheading']}
				</p>

				<div className="mt-10 rounded-2xl border border-dashed border-border bg-surface p-10">
					<Icons.Logistics
						size={32}
						className="mx-auto opacity-30"
						aria-hidden="true"
					/>
					<p className="mt-4 text-muted">
						{translations['text.placeholder']}
					</p>
					<Link
						variant="outline"
						className="mt-6"
						href={Routes.get('products-categories')}
					>
						{translations['text.browse_categories']}
					</Link>
				</div>
			</div>
		</div>
	);
}
