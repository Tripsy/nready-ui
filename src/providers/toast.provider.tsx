'use client';

import { ToastProvider as HeroToastProvider, toast } from '@heroui/react';
import type React from 'react';
import { createContext, useContext } from 'react';

type ToastOptions = {
	severity: 'success' | 'info' | 'warn' | 'error';
	summary: string;
	detail?: string;
	life?: number;
	/** One button beside the message - the step a confirmation leads to, like opening the cart. */
	action?: {
		label: string;
		onPress: () => void;
	};
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
	// summary -> toast title (first arg), detail -> description, life -> timeout (ms),
	// action -> the toast's own action button.
	const showToast = ({
		severity,
		summary,
		detail,
		life,
		action,
	}: ToastOptions): void => {
		const key = toast[TOAST_METHOD[severity]](summary, {
			description: detail,
			timeout: life ?? 7000, // default to 7 seconds
			actionProps: action
				? {
						children: action.label,
						// Closed on press: the provider lives above the page, so a toast whose
						// action navigates would otherwise stay open over where it led.
						onPress: () => {
							toast.close(key);
							action.onPress();
						},
					}
				: undefined,
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
