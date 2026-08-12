import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/helpers/css.helper';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-fit font-medium cursor-pointer ' +
		'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default:
					'bg-accent text-accent-foreground hover:bg-accent-hover',
				outline:
					'border border-border bg-background hover:bg-surface-secondary hover:text-foreground',
				secondary:
					'bg-default text-default-foreground hover:bg-default-hover',
				ghost: '',
				success:
					'bg-success text-accent-foreground hover:bg-success-hover',
				error: 'bg-danger text-danger-foreground hover:bg-danger-hover',
				warning:
					'bg-warning text-accent-foreground hover:bg-warning-hover',
			},
			hover: {
				success:
					'hover:bg-success/90 hover:text-accent-foreground hover:border-transparent',
				error: 'hover:bg-danger/80 hover:text-danger-foreground hover:border-transparent',
				warning:
					'hover:bg-warning/70 hover:text-accent-foreground hover:border-transparent',
				default:
					'hover:bg-accent hover:text-accent-foreground hover:border-transparent',
			},
			size: {
				xs: 'text-xs px-2 py-1.5',
				sm: 'text-sm p-2',
				md: 'text-sm py-2 px-4',
				lg: 'px-8',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	},
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
export type ButtonHover = VariantProps<typeof buttonVariants>['hover'];

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

// Renders a plain <button>. For a link styled as a button use `ui/link`, which
// applies the same `buttonVariants` to a NextLink — that replaced the previous
// `asChild`/Slot escape hatch and keeps the anchor/button distinction explicit.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, hover, ...props }, ref) => {
		return (
			<button
				className={cn(
					buttonVariants({ variant, size, hover }),
					variant === 'ghost' && 'p-0',
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = 'Button';

export { Button, buttonVariants };
