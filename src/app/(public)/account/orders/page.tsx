import type { Metadata } from 'next';
import { Breadcrumb } from '@/app/(public)/_components/breadcrumb.component';
import { AccountOrders } from '@/app/(public)/account/orders/account-orders.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('order.storefront.meta_title', {
			app_name: Configuration.get('app.name'),
		}),
		// Per-account and behind a session - nothing here a crawler could reach or reuse.
		robots: { index: false, follow: false },
	};
}

export default async function Page() {
	const translations = await translateBatch([
		'order.storefront.heading',
		'layout.menu.account',
	]);
	const heading = translations['order.storefront.heading'];

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				<Breadcrumb
					items={[
						{
							label: translations['layout.menu.account'],
							href: Routes.get('account-me'),
						},
						{ label: heading },
					]}
				/>

				<h1 className="mt-8 text-2xl font-semibold md:text-3xl">
					{heading}
				</h1>

				{/*
				 * A client island: the list is the viewer's own and read through the proxy with their
				 * session. The route is authenticated in `routes.setup.ts`, so a guest never reaches
				 * this render.
				 */}
				<div className="mt-8">
					<AccountOrders />
				</div>
			</div>
		</div>
	);
}
