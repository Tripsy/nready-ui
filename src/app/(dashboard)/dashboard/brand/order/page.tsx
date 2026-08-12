import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableBrandOrder } from '@/app/(dashboard)/dashboard/brand/order/data-table-brand-order.component';
import Routes from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('brand-order.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{
			label: await translate('dashboard.labels.brand'),
			href: Routes.get('brand'),
		},
		{
			label: await translate('dashboard.labels.brand-order'),
		},
	];

	return (
		<>
			<BreadcrumbSetter page="brand" items={items} />
			<DataTableBrandOrder />
		</>
	);
}
