'use client';

import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/providers/theme.provider';
import type { LayoutTranslations } from '@/types/layout.type';

type ToggleThemeProps = {
	translations: LayoutTranslations;
};

export function ToggleTheme({ translations }: ToggleThemeProps) {
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === 'dark';

	return (
		<Switch
			size="lg"
			isSelected={isDark}
			onChange={toggleTheme}
			aria-label={translations['layout.aria.toggle_theme']}
			thumbIcon={
				isDark ? (
					<Moon className="h-4 w-4" />
				) : (
					<Sun className="h-4 w-4" />
				)
			}
		/>
	);
}
