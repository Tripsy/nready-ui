import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableExchangeRate } from '@/app/(dashboard)/dashboard/exchange-rate/data-table-exchange-rate.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('exchange-rate.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.exchange-rate') },
	];

	return (
		<>
			<BreadcrumbSetter page="exchange-rate" items={items} />
			<DataTableExchangeRate />
		</>
	);
}
