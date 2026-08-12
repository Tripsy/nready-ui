import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/footer.default';
import { Header } from '@/components/layout/header.default';
import { WindowContainer } from '@/components/window/window-container.component';
import { Configuration } from '@/config/settings.config';
import { getLanguage, translateBatch } from '@/config/translate.setup';
import { LAYOUT_TRANSLATION_KEYS } from '@/types/layout.type';

export default async function Layout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const currentLanguage = await getLanguage();
	const supportedLanguages = Configuration.get('language.supported');
	const translations = await translateBatch(LAYOUT_TRANSLATION_KEYS);

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Header
				currentLanguage={currentLanguage}
				supportedLanguages={supportedLanguages}
				translations={translations}
			/>
			<main className="flex-1">{children}</main>
			<WindowContainer section="public" />
			<Footer />
		</div>
	);
}
