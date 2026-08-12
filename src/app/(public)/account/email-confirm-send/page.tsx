import type { Metadata } from 'next';
import EmailConfirmSend from '@/app/(public)/account/email-confirm-send/email-confirm-send.component';
import { EMAIL_CONFIRM_SEND_TRANSLATION_KEYS } from '@/app/(public)/account/email-confirm-send/email-confirm-send.definition';
import ProtectedRoute from '@/components/protected-route.component';
import { RouteAuthEnum } from '@/config/routes.setup';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('email-confirm-send.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
		robots: 'noindex, nofollow',
	};
}

export default async function Page() {
	const translations = await translateBatch(
		EMAIL_CONFIRM_SEND_TRANSLATION_KEYS,
	);

	return (
		<ProtectedRoute routeAuth={RouteAuthEnum.UNAUTHENTICATED}>
			<div className="bg-gradient-hero">
				<EmailConfirmSend translations={translations} />
			</div>
		</ProtectedRoute>
	);
}
