'use client';

import { ToastProvider as HeroToastProvider, toast } from '@heroui/react';
import type React from 'react';
import { createContext, useContext } from 'react';

type ToastOptions = {
	severity: 'success' | 'info' | 'warn' | 'error';
	summary: string;
	detail?: string;
	life?: number;
};

type ToastContextType = {
	showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

// Map the app's severity vocabulary onto HeroUI's imperative toast variants.
const TOAST_METHOD = {
	success: 'success',
	info: 'info',
	warn: 'warning',
	error: 'danger',
} as const;

function ToastProvider({ children }: { children: React.ReactNode }) {
	// summary -> toast title (first arg), detail -> description, life -> timeout (ms).
	const showToast = ({
		severity,
		summary,
		detail,
		life,
	}: ToastOptions): void => {
		toast[TOAST_METHOD[severity]](summary, {
			description: detail,
			timeout: life ?? 7000, // default to 7 seconds
		});
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			<HeroToastProvider placement="top end" />
			{children}
		</ToastContext.Provider>
	);
}

function useToast() {
	const context = useContext(ToastContext);

	if (!context) {
		throw new Error('useToast must be used within a ToastProvider');
	}

	return context;
}

export { ToastProvider, useToast };
