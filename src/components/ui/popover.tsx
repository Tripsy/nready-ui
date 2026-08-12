import { Popover as HeroPopover } from '@heroui/react';
import type * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';

// Root is react-aria's DialogTrigger: controlled via `isOpen` / `onOpenChange`.
const Popover = HeroPopover;

/**
 * Renders the popover trigger as the project `Button`.
 *
 * HeroUI's own `Popover.Trigger` is a `role="button"` div wrapped in react-aria's
 * `Pressable` — it neither carries the project button styling nor supports
 * `disabled` (it forwards nothing to `Pressable`). Its `render` escape hatch lets
 * us substitute a real `<button>`; the DOM props handed back are typed for the
 * default `div`, so the cast is contained here rather than at every call site.
 */
const PopoverTriggerButton = ({ className, ...buttonProps }: ButtonProps) => (
	<HeroPopover.Trigger
		render={(domProps) => (
			<Button
				{...(domProps as ButtonProps)}
				{...buttonProps}
				className={cn(domProps.className, className)}
			/>
		)}
	/>
);

type PopoverContentProps = React.ComponentProps<typeof HeroPopover.Content>;

/**
 * The positioned surface. HeroUI's `.popover` uses `min(32px, --radius-3xl)`, the
 * same oversized radius that had to be overridden on the Select/ComboBox popovers —
 * pinned to `rounded-md` here so every overlay matches the form fields.
 *
 * Padding stays on the surface rather than the inner dialog (`p-0`), so callers keep
 * controlling it through `className` exactly as they did with the Radix wrapper.
 */
const PopoverContent = ({
	className,
	children,
	...props
}: PopoverContentProps) => (
	<HeroPopover.Content className={cn('rounded-md', className)} {...props}>
		<HeroPopover.Dialog className="p-0">{children}</HeroPopover.Dialog>
	</HeroPopover.Content>
);

export { Popover, PopoverContent, PopoverTriggerButton };
