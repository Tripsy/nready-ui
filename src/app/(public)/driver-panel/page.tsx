import type { Metadata } from 'next';
import { WorkSessionProvider } from '@/app/(public)/_providers/work-session.provider';
import { DriverPanel } from '@/app/(public)/driver-panel/driver-panel.component';
import ProtectedRoute from '@/components/protected-route.component';
import { RouteAuthEnum } from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('driver-panel.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	return (
		<ProtectedRoute routeAuth={RouteAuthEnum.AUTHENTICATED}>
			<WorkSessionProvider>
				<DriverPanel />
			</WorkSessionProvider>
		</ProtectedRoute>
	);
}
