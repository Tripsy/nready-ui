import type { Metadata } from 'next';
import Register from '@/app/(public)/account/register/register.component';
import { REGISTER_TRANSLATION_KEYS } from '@/app/(public)/account/register/register.definition';
import ProtectedRoute from '@/components/protected-route.component';
import { RouteAuthEnum } from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('register.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const translations = await translateBatch(REGISTER_TRANSLATION_KEYS);

	return (
		<ProtectedRoute routeAuth={RouteAuthEnum.UNAUTHENTICATED}>
			<div className="bg-gradient-hero">
				<Register translations={translations} />
			</div>
		</ProtectedRoute>
	);
}
