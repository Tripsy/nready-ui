import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableStockAdjustment } from '@/app/(dashboard)/dashboard/stock-adjustment/data-table-stock-adjustment.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('stock-adjustment.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.stock-adjustment') },
	];

	return (
		<>
			<BreadcrumbSetter page="stock-adjustment" items={items} />
			<DataTableStockAdjustment />
		</>
	);
}
