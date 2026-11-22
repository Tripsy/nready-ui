import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableCostOverFloor } from '@/app/(dashboard)/dashboard/cost-over-floor/data-table-cost-over-floor.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('cost-over-floor.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.cost-over-floor') },
	];

	return (
		<>
			<BreadcrumbSetter page="cost-over-floor" items={items} />
			<DataTableCostOverFloor />
		</>
	);
}
