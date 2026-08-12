import type { Metadata } from 'next';
import Me from '@/app/(public)/account/me/account-me.component';
import ProtectedRoute from '@/components/protected-route.component';
import { RouteAuthEnum } from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('account.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	return (
		<ProtectedRoute routeAuth={RouteAuthEnum.AUTHENTICATED}>
			<div className="bg-gradient-hero">
				<Me />
			</div>
		</ProtectedRoute>
	);
}
