import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableCmrVehicle } from '@/app/(dashboard)/dashboard/cmr-vehicle/data-table-cmr-vehicle.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('cmr-vehicle.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.cmr-vehicle') },
	];

	return (
		<>
			<BreadcrumbSetter page="cmr-vehicle" items={items} />
			<DataTableCmrVehicle />
		</>
	);
}
