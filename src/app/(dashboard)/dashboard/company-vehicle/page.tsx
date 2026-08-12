import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableCompanyVehicle } from '@/app/(dashboard)/dashboard/company-vehicle/data-table-company-vehicle.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('company-vehicle.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.company-vehicle') },
	];

	return (
		<>
			<BreadcrumbSetter page="company-vehicle" items={items} />
			<DataTableCompanyVehicle />
		</>
	);
}
