import type { Metadata } from 'next';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { CheckoutForm } from '@/app/(public)/checkout/checkout.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('checkout.meta_title', {
			app_name: Configuration.get('app.name'),
		}),
		// Per-account and behind a session - nothing here a crawler could reach or reuse.
		robots: { index: false, follow: false },
	};
}

export default async function Page() {
	const heading = await translate('checkout.heading');

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb items={[{ label: heading }]} />

				<h1 className="mt-8 text-2xl font-semibold md:text-3xl">
					{heading}
				</h1>

				{/*
				 * A client island for the same reason as the cart page: the basket is priced at
				 * read time and the billing entries are the viewer's own. The route is
				 * authenticated in `routes.setup.ts`, so a guest never reaches this render.
				 */}
				<div className="mt-8">
					<CheckoutForm />
				</div>
			</div>
		</div>
	);
}
