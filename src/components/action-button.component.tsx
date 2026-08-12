import type { LucideProps } from 'lucide-react';
import type { JSX } from 'react';
import React from 'react';
import { getActionIcon } from '@/components/icon.component';
import { LoadingIcon } from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { capitalizeFirstLetter } from '@/helpers/string.helper';
import type { ButtonAppearanceType } from '@/types/html.type';

type ActionCommand = {
	type: 'action';
	onClick: () => void;
};

type LinkCommand = {
	type: 'link';
	href: string;
	target?: string;
};

export type ButtonCommand = ActionCommand | LinkCommand;

export function ActionButtonContent({
	icon,
	action,
	label,
}: {
	icon?: React.ReactElement | React.ComponentType<LucideProps> | string;
	action: string;
	label: string | JSX.Element;
}) {
	const iconSource = icon || action;

	let iconElement: React.ReactElement | null = null;

	if (React.isValidElement(iconSource)) {
		// Already a JSX element
		iconElement = iconSource;
	} else if (typeof iconSource === 'string') {
		const IconComponent = getActionIcon(iconSource);

		if (IconComponent) {
			iconElement = <IconComponent className="h-4 w-4" />;
		}
	} else if (iconSource) {
		// A component type was passed directly — covers plain function
		// components, class components, and forwardRef/memo wrapper objects
		const IconComponent = iconSource as React.ComponentType<LucideProps>;

		iconElement = <IconComponent className="h-4 w-4" />;
	}

	return (
		<>
			{iconElement}
			{label}
		</>
	);
}

export function ActionButton({
	action,
	buttonAppearance,
	disabled = false,
	command,
}: {
	action: string;
	buttonAppearance?: ButtonAppearanceType;
	disabled?: boolean;
	command: ButtonCommand;
}) {
	const label = buttonAppearance?.label ?? capitalizeFirstLetter(action);
	const title = buttonAppearance?.title
		? buttonAppearance.title.replace(' - {{entry}}', '')
		: buttonAppearance?.label && typeof buttonAppearance?.label === 'string'
			? buttonAppearance.label
			: capitalizeFirstLetter(action);

	const content = disabled ? (
		<>
			<LoadingIcon />
			{buttonAppearance?.loadingLabel ?? 'Please wait...'}
		</>
	) : (
		<ActionButtonContent
			icon={buttonAppearance?.icon}
			action={action}
			label={label}
		/>
	);

	// A link command renders an anchor that shares the button styling (`ui/link`
	// applies the same `buttonVariants`). While disabled we fall back to a real
	// <button> instead — an anchor has no disabled state, so a styled-but-live
	// link would still navigate mid-action.
	if (command.type === 'link' && !disabled) {
		return (
			<Link
				variant={buttonAppearance?.variant}
				hover={buttonAppearance?.hover}
				size={buttonAppearance?.size}
				className={buttonAppearance?.className}
				title={title}
				href={command.href}
				target={command.target ?? '_self'}
			>
				{content}
			</Link>
		);
	}

	return (
		<Button
			variant={buttonAppearance?.variant}
			hover={buttonAppearance?.hover}
			size={buttonAppearance?.size}
			className={buttonAppearance?.className}
			title={title}
			onClick={command.type === 'action' ? command.onClick : undefined}
			disabled={disabled}
		>
			{content}
		</Button>
	);
}
