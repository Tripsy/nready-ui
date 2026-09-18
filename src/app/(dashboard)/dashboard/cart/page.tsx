import type { Metadata } from 'next';
import BreadcrumbSetter from '@/app/(dashboard)/_components/breadcrumb.setter';
import type { BreadcrumbType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { DataTableCart } from '@/app/(dashboard)/dashboard/cart/data-table-cart.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('cart.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const items: BreadcrumbType[] = [
		{ label: await translate('dashboard.labels.cart') },
	];

	return (
		<>
			<BreadcrumbSetter page="cart" items={items} />
			<DataTableCart />
		</>
	);
}
