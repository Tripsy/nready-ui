import type { LucideProps } from 'lucide-react';
import type React from 'react';
import type {
	ButtonHover,
	ButtonSize,
	ButtonVariant,
} from '@/components/ui/button';

export type ButtonAppearanceType = {
	className?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	hover?: ButtonHover;
	title?: string; // Tooltip text for the button
	icon?: React.ReactElement | React.ComponentType<LucideProps> | string; // Icon displayed in the button along with the label
	label?: string | React.ReactElement; // Content text for the button
	loadingLabel?: string; // Content text for the button when loading
};
