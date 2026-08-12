import type { Metadata } from 'next';
import PasswordRecover from '@/app/(public)/account/password-recover/password-recover.component';
import { PASSWORD_RECOVER_TRANSLATION_KEYS } from '@/app/(public)/account/password-recover/password-recover.definition';
import ProtectedRoute from '@/components/protected-route.component';
import { RouteAuthEnum } from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('password-recover.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
		robots: 'noindex, nofollow',
	};
}

export default async function Page() {
	const translations = await translateBatch(
		PASSWORD_RECOVER_TRANSLATION_KEYS,
	);

	return (
		<ProtectedRoute routeAuth={RouteAuthEnum.UNAUTHENTICATED}>
			<div className="bg-gradient-hero">
				<PasswordRecover translations={translations} />
			</div>
		</ProtectedRoute>
	);
}
