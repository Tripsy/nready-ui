'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
};

const ThemeContext = createContext<
	| {
			theme: Theme;
			toggleTheme: () => void;
	  }
	| undefined
>(undefined);

export function ThemeProvider({
	children,
	defaultTheme = 'light',
	storageKey = 'ui-theme',
	...props
}: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>(defaultTheme);

	useEffect(() => {
		let savedTheme = localStorage.getItem(storageKey);

		if (!savedTheme) {
			savedTheme = window.matchMedia('(prefers-color-scheme: dark)')
				.matches
				? 'dark'
				: 'light';
		}

		setTheme((savedTheme as Theme) || defaultTheme);
	}, [defaultTheme, storageKey]);

	useEffect(() => {
		const root = window.document.documentElement;

		root.classList.remove('light', 'dark');
		root.classList.add(theme);
	}, [theme]);

	const value = {
		theme,
		toggleTheme: () => {
			const newTheme = theme === 'light' ? 'dark' : 'light';

			localStorage.setItem(storageKey, newTheme);
			setTheme(newTheme);
		},
	};

	return (
		<ThemeContext.Provider {...props} value={value}>
			{children}
		</ThemeContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeContext);

	if (context === undefined)
		throw new Error('useTheme must be used within a ThemeProvider');

	return context;
};
