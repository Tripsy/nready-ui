import type { Metadata } from 'next';
import OAuthCallback from '@/app/(public)/account/oauth/[provider]/oauth-callback.component';
import { OAUTH_CALLBACK_TRANSLATION_KEYS } from '@/app/(public)/account/oauth/[provider]/oauth-callback.definition';
import { Configuration } from '@/config/settings.config';
import { translate, translateBatch } from '@/config/translate.setup';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: await translate('login.meta.title', {
			app_name: Configuration.get('app.name'),
		}),
		// A URL carrying a live authorization code has no business in an index.
		robots: { index: false, follow: false },
	};
}

/**
 * Where the provider returns the browser. The exchange itself runs in a server action from
 * the client component below — a Server Component cannot write the session cookie during
 * render, and the max-active-sessions case needs a real screen rather than a redirect.
 */
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ provider: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { provider } = await params;
	const query = await searchParams;
	const translations = await translateBatch(OAUTH_CALLBACK_TRANSLATION_KEYS);

	const readParam = (name: string): string | null => {
		const value = query[name];

		return typeof value === 'string' ? value : null;
	};

	return (
		<div className="bg-gradient-hero">
			<OAuthCallback
				provider={provider}
				code={readParam('code')}
				state={readParam('state')}
				providerError={readParam('error')}
				translations={translations}
			/>
		</div>
	);
}
