import type { JSX } from 'react';
import { cn } from '@/helpers/css.helper';

export const FormElementError = ({
	messages,
	className,
}: {
	messages?: string[];
	className?: string;
}): JSX.Element | null =>
	messages?.length ? (
		<div className={cn('form-element-error', className)}>
			{messages.length === 1 ? (
				messages[0]
			) : (
				<ul>
					{messages.map((msg) => (
						<li key={msg}>- {msg}</li>
					))}
				</ul>
			)}
		</div>
	) : null;
