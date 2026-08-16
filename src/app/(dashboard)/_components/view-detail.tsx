import type { ReactNode } from 'react';
import { cn } from '@/helpers/css.helper';

const FIELD_GRID =
	'grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3';

type ViewSectionProps = {
	readonly title?: string;
	readonly children: ReactNode;
	readonly className?: string;
	/**
	 * `grid` (the default) flows every child through one responsive grid, so where a field
	 * lands depends on how many precede it. `rows` hands that placement to the caller, whose
	 * children are then `ViewRow`s — the way to keep two fields together on a line, or to end
	 * a line early, neither of which auto-flow can express.
	 */
	readonly layout?: 'grid' | 'rows';
};

/** Titled, divider-underlined group of `ViewField`s. */
export function ViewSection({
	title,
	children,
	className,
	layout = 'grid',
}: ViewSectionProps) {
	return (
		<div className={className}>
			{title && (
				<h3 className="font-bold border-b border-line pb-2 mb-4">
					{title}
				</h3>
			)}
			<div className={layout === 'rows' ? 'space-y-4' : FIELD_GRID}>
				{children}
			</div>
		</div>
	);
}

/** One line of a `layout="rows"` section; splits into columns exactly as the grid does. */
export function ViewRow({
	children,
	className,
}: {
	readonly children: ReactNode;
	readonly className?: string;
}) {
	return <div className={cn(FIELD_GRID, className)}>{children}</div>;
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
