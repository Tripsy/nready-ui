import type React from 'react';
import { cn } from '@/helpers/css.helper';

function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'animate-pulse rounded-md bg-surface-secondary',
				className,
			)}
			{...props}
		/>
	);
}

export { Skeleton };
