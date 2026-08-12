import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableLogHistory } from '@/app/(dashboard)/dashboard/log-history/data-table-log-history.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('log-history.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}
export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.log-history') },
	];

	return (
		<>
			<BreadcrumbSetter page="log-history" items={items} />
			<DataTableLogHistory />
		</>
	);
}
