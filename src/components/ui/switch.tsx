'use client';

import { Switch as HeroSwitch } from '@heroui/react';
import type { ComponentProps, ReactNode } from 'react';

type SwitchProps = Omit<ComponentProps<typeof HeroSwitch>, 'children'> & {
	thumbIcon?: ReactNode;
	children?: ReactNode;
};

/**
 * Thin wrapper over HeroUI v3's compound Switch. `Switch.Content` is the interactive
 * `SwitchButton` (the clickable label) and must wrap the visual `Control`/`Thumb` —
 * without it the switch renders but does nothing. Forwards react-aria Switch props
 * (isSelected, onChange, isDisabled, size…). `thumbIcon` renders inside the thumb;
 * `children` become the label text next to the control.
 */
export function Switch({ thumbIcon, children, ...props }: SwitchProps) {
	return (
		<HeroSwitch {...props}>
			<HeroSwitch.Content>
				<HeroSwitch.Control>
					<HeroSwitch.Thumb>
						{thumbIcon ? (
							<span className="flex items-center justify-center whitespace-nowrap leading-none">
								{thumbIcon}
							</span>
						) : null}
					</HeroSwitch.Thumb>
				</HeroSwitch.Control>
				{children}
			</HeroSwitch.Content>
		</HeroSwitch>
	);
}
