import type { VariantProps } from 'class-variance-authority';
import NextLink from 'next/link';
import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';

const linkVariants = buttonVariants;

// export type LinkVariant = VariantProps<typeof linkVariants>['variant'];
// export type LinkSize = VariantProps<typeof linkVariants>['size'];
// export type LinkHover = VariantProps<typeof linkVariants>['hover'];

export interface LinkProps
	extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
		VariantProps<typeof linkVariants> {
	href: string;
	external?: boolean;
	prefetch?: boolean;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
	(
		{
			className,
			variant,
			size,
			hover,
			href,
			external = false,
			prefetch = true,
			children,
			...props
		},
		ref,
	) => {
		// External links skip NextLink entirely — there is nothing to prefetch
		// or soft-navigate to — and get the usual noopener/noreferrer hardening.
		if (external) {
			return (
				<a
					className={cn(
						linkVariants({ variant, size, hover, className }),
					)}
					href={href}
					ref={ref}
					target="_blank"
					rel="noopener noreferrer"
					{...props}
				>
					{children}
				</a>
			);
		}

		// Internal Next.js link
		return (
			<NextLink
				href={href}
				prefetch={prefetch}
				className={cn(
					linkVariants({ variant, size, hover, className }),
				)}
				ref={ref}
				{...props}
			>
				{children}
			</NextLink>
		);
	},
);

Link.displayName = 'Link';

export { Link, linkVariants };
