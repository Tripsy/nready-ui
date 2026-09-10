import type { Metadata } from 'next';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { CartBasket } from '@/app/(public)/cart/cart-basket.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('cart.storefront.meta_title', {
			app_name: Configuration.get('app.name'),
		}),
		// The basket is the viewer's own and changes on every action, so there is nothing here
		// worth a crawler's time and nothing that would be the same for the next visitor.
		robots: { index: false, follow: true },
	};
}

export default async function Page() {
	const heading = await translate('cart.storefront.heading');

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb items={[{ label: heading }]} />

				<h1 className="mt-8 text-2xl font-semibold md:text-3xl">
					{heading}
				</h1>

				{/*
				 * The whole page below is a client island. Nothing about a cart can be rendered
				 * on the server usefully: it is per-viewer, it is priced against the catalog at
				 * read time, and it changes with every button on it.
				 */}
				<div className="mt-8">
					<CartBasket />
				</div>
			</div>
		</div>
	);
}
