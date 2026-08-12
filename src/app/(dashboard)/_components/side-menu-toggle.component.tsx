'use client';

import { Menu, X } from 'lucide-react';
import { useSideMenu } from '@/app/(dashboard)/_providers/side-menu.provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';

export function SideMenuToggle() {
	const { menuState, menuToggle } = useSideMenu();

	return (
		<Button
			variant="ghost"
			onClick={menuToggle}
			className="relative h-10 w-10 rounded-full"
			aria-label={menuState === 'open' ? 'Close menu' : 'Open menu'}
		>
			<Menu
				className={cn(
					'absolute h-5 w-5 transition-all duration-500 ease-in-out',
					menuState === 'open'
						? 'rotate-180 scale-0 opacity-0'
						: 'rotate-0 scale-100 opacity-100',
				)}
			/>
			<X
				className={cn(
					'absolute h-5 w-5 transition-all duration-500 ease-in-out',
					menuState === 'open'
						? 'rotate-0 scale-100 opacity-100'
						: '-rotate-180 scale-0 opacity-0',
				)}
			/>
		</Button>
	);
}
