import * as React from 'react';
import { cn } from '@/helpers/css.helper';

export interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'flex min-h-20 w-full rounded-md border border-border bg-field px-3 py-2 text-sm text-field-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Textarea.displayName = 'Textarea';

export { Textarea };
