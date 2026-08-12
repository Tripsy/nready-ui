import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableWorkSessionVehicle } from '@/app/(dashboard)/dashboard/work-session-vehicle/data-table-work-session-vehicle.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('work-session-vehicle.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.work-session-vehicle') },
	];

	return (
		<>
			<BreadcrumbSetter page="work-session-vehicle" items={items} />
			<DataTableWorkSessionVehicle />
		</>
	);
}
