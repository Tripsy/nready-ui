import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function isLargeScreen(): boolean {
	if (typeof window === 'undefined') {
		return true;
	} // SSR safety

	// `matchMedia` only throws on a malformed query, and this one is a literal — so there
	// is no failure mode here to guard against.
	return window.matchMedia('(min-width: 1024px)').matches;
}
