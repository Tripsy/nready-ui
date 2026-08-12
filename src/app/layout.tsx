import './globals.css';
import type { ReactNode } from 'react';
import { Providers } from '@/app/providers';
import { NavigationProgress } from '@/components/layout/navigation-progress.component';
import { getLanguage, translate } from '@/config/translate.setup';

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const currentLanguage = await getLanguage();
	const loadingLabel = await translate('layout.aria.loading_page');

	return (
		<Providers>
			<html lang={currentLanguage} data-scroll-behavior="smooth">
				<body>
					<NavigationProgress label={loadingLabel} />
					{children}
				</body>
			</html>
		</Providers>
	);
}
