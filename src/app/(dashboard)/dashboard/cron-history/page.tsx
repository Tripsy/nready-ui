import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableCronHistory } from '@/app/(dashboard)/dashboard/cron-history/data-table-cron-history.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('cron-history.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}
export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.cron-history') },
	];

	return (
		<>
			<BreadcrumbSetter page="cron-history" items={items} />
			<DataTableCronHistory />
		</>
	);
}
