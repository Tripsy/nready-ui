import type { Metadata } from 'next';
import Login from '@/app/(public)/account/login/login.component';
import { LOGIN_TRANSLATION_KEYS } from '@/app/(public)/account/login/login.definition';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('login.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
	};
}

export default async function Page() {
	const translations = await translateBatch(LOGIN_TRANSLATION_KEYS);

	return (
		<div className="bg-gradient-hero">
			<Login translations={translations} />
		</div>
	);
}
