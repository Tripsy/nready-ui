import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/helpers/css.helper';

const badgeVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-fit font-semibold' +
		'transition-colors focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2',
	{
		variants: {
			// `bg-<name> text-<name>-foreground` throughout: a base is only legible against the
			// foreground token it was tuned with in `globals.css`, so the two halves move
			// together. Borrowing another variant's foreground is what breaks that.
			variant: {
				default: 'bg-accent text-accent-foreground',
				secondary: 'bg-default text-default-foreground',
				success: 'bg-success text-success-foreground',
				error: 'bg-danger text-danger-foreground',
				warning: 'bg-warning text-warning-foreground',
				info: 'bg-info text-info-foreground',
			},
			size: {
				md: 'px-4 py-2',
				xs: 'text-xs px-2 py-1.5',
				sm: 'text-sm p-2',
				lg: 'px-8',
				status: 'text-sm px-2 py-1.5',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	},
);

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
export type BadgeSize = VariantProps<typeof badgeVariants>['size'];

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
	return (
		<div
			className={cn(badgeVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
