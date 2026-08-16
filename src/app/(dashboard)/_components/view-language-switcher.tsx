import { cn } from '@/helpers/css.helper';

type ViewLanguageSwitcherProps<T extends string> = {
	readonly label?: string;
	readonly languages: readonly T[];
	readonly selected: T;
	readonly onSelect: (language: T) => void;
};

/**
 * Heading plus the language toggles for a view's per-language block, mirroring the manage
 * form's switcher so the two read as the same control.
 *
 * A group of toggle buttons rather than a tab list: it selects which translation the fields
 * below show, and those fields are the same in every language — there is no per-language
 * panel of its own for a tab to describe.
 *
 * It lives apart from `view-detail.tsx` because it needs an event handler: marking that
 * module `'use client'` would pull every view that imports `ViewField` client-side with it.
 */
export function ViewLanguageSwitcher<T extends string>({
	label,
	languages,
	selected,
	onSelect,
}: ViewLanguageSwitcherProps<T>) {
	return (
		<div className="flex items-center gap-2 mb-4">
			{label && <h3 className="font-bold whitespace-nowrap">{label}</h3>}
			{languages.map((language) => (
				<button
					key={language}
					type="button"
					aria-pressed={language === selected}
					onClick={() => onSelect(language)}
					className={cn(
						'rounded-md border px-3 py-1 text-sm transition-colors',
						language === selected
							? 'border-focus bg-accent-soft font-medium'
							: 'border-border opacity-70 hover:opacity-100',
					)}
				>
					{language.toUpperCase()}
				</button>
			))}
		</div>
	);
}
