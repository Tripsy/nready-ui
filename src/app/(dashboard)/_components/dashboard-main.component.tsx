'use client';

import clsx from 'clsx';
import type React from 'react';
import { useSideMenu } from '@/app/(dashboard)/_providers/side-menu.provider';

export default function DashboardMain({
	children,
}: {
	children: React.ReactNode;
}) {
	const { menuState } = useSideMenu();

	return (
		<main
			className={clsx(
				'main-section',
				menuState === 'open' ? 'side-menu-open' : 'side-menu-closed',
			)}
		>
			{children}
		</main>
	);
}
