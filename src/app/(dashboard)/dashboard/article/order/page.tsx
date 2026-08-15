import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableArticleOrder } from '@/app/(dashboard)/dashboard/article/order/data-table-article-order.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('article-order.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{
			label: await translate('dashboard.labels.article'),
			href: Routes.get('article'),
		},
		{
			label: await translate('dashboard.labels.article-order'),
		},
	];

	return (
		<>
			<BreadcrumbSetter page="article" items={items} />
			<DataTableArticleOrder />
		</>
	);
}
