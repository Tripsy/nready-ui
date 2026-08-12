import type { ReactNode } from 'react';
import { cn } from '@/helpers/css.helper';

type ViewSectionProps = {
	readonly title?: string;
	readonly children: ReactNode;
	readonly className?: string;
};

/** Titled, divider-underlined group of `ViewField`s laid out in a responsive grid. */
export function ViewSection({ title, children, className }: ViewSectionProps) {
	return (
		<div className={className}>
			{title && (
				<h3 className="font-bold border-b border-line pb-2 mb-4">
					{title}
				</h3>
			)}
			<div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
				{children}
			</div>
		</div>
	);
}

type ViewFieldProps = {
	readonly label: string;
	readonly value?: ReactNode;
	/** Span the full width of the grid instead of a single column. */
	readonly full?: boolean;
	readonly className?: string;
};

/** Label-above-value pair, the base unit of a `ViewSection` grid. */
export function ViewField({ label, value, full, className }: ViewFieldProps) {
	return (
		<div
			className={cn(
				'space-y-1',
				full && 'sm:col-span-2 lg:col-span-3',
				className,
			)}
		>
			<div className="text-xs font-medium uppercase tracking-wide text-muted">
				{label}
			</div>
			<div className="text-sm">
				{value === undefined || value === null || value === '' ? (
					<span className="text-muted">n/a</span>
				) : (
					value
				)}
			</div>
		</div>
	);
}
