import type { Metadata } from 'next';
import { AccountOrderView } from '@/app/(public)/account/orders/[id]/account-order-view.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

interface Props {
	params: Promise<{
		id: string;
	}>;
}

export async function generateMetadata(): Promise<Metadata> {
	return {
		// The reference is not known here without a server-side read the page does not otherwise
		// need, so the tab carries the list's title.
		title: await translate('order.storefront.meta_title', {
			app_name: Configuration.get('app.name'),
		}),
		robots: { index: false, follow: false },
	};
}

export default async function Page({ params }: Props) {
	const { id } = await params;
	const translations = await translateBatch([
		'order.storefront.heading',
		'layout.menu.account',
	]);

	return (
		<div className="container-default py-12 md:py-16">
			<div className="mx-auto max-w-5xl">
				{/*
				 * A client island like the list, and it closes its own breadcrumb: the last crumb is
				 * the order's reference, which only the client-side read knows, while the crumbs
				 * above it are translated here - client translations are empty for a render. A malformed or
				 * foreign id is answered inside it rather than with `notFound()` - the server has
				 * nothing to decide a status from, and the page is noindex regardless.
				 */}
				<AccountOrderView
					id={Number(id)}
					trail={[
						{
							label: translations['layout.menu.account'],
							href: Routes.get('account-me'),
						},
						{
							label: translations['order.storefront.heading'],
							href: Routes.get('account-orders'),
						},
					]}
				/>
			</div>
		</div>
	);
}
