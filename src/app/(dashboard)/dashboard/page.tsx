import type { Metadata } from 'next';
import { DashboardHome } from '@/app/(dashboard)/dashboard/dashboard-home.component';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('dashboard.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	return <DashboardHome />;
}
