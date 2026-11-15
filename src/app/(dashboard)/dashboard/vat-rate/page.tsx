import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableVatRate } from '@/app/(dashboard)/dashboard/vat-rate/data-table-vat-rate.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('vat-rate.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.vat-rate') },
	];

	return (
		<>
			<BreadcrumbSetter page="vat-rate" items={items} />
			<DataTableVatRate />
		</>
	);
}
