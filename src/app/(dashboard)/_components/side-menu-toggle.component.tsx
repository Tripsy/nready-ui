'use client';

import { Menu, X } from 'lucide-react';
import { useSideMenu } from '@/app/(dashboard)/_providers/side-menu.provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';
import { useTranslation } from '@/hooks/use-translation.hook';

const TRANSLATION_KEYS = [
	'dashboard.text.label_menu_open',
	'dashboard.text.label_menu_close',
] as const;

export function SideMenuToggle() {
	const { menuState, menuToggle } = useSideMenu();

	const { translations } = useTranslation(TRANSLATION_KEYS);

	return (
		<Button
			variant="ghost"
			onClick={menuToggle}
			className="relative h-10 w-10 rounded-full"
			aria-label={
				menuState === 'open'
					? translations['dashboard.text.label_menu_close']
					: translations['dashboard.text.label_menu_open']
			}
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
