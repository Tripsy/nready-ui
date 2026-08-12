import type { Metadata } from 'next';
import Logout from '@/app/(public)/account/logout/logout.component';
import { LOGOUT_TRANSLATION_KEYS } from '@/app/(public)/account/logout/logout.definition';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('logout.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const translations = await translateBatch(LOGOUT_TRANSLATION_KEYS);

	return <Logout translations={translations} />;
}
