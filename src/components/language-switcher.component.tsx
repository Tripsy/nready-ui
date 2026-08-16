'use client';

import { cn } from '@/helpers/css.helper';

type LanguageSwitcherProps<T extends string> = {
	readonly label?: string;
	readonly languages: readonly T[];
	readonly selected: T;
	readonly onSelect: (language: T) => void;
	/** Held down while a save is in flight, so the panel below cannot swap mid-write. */
	readonly disabled?: boolean;
	readonly className?: string;
};

/**
 * Optional heading plus the language toggles for a per-language block.
 *
 * A group of toggle buttons rather than a tab list: it selects which translation the fields
 * below show, and those fields are the same in every language — there is no per-language
 * panel of its own for a tab to describe.
 *
 * Common rather than dashboard-scoped because `manager-images` uses it too, and that lives in
 * `src/components`; an import reaching the other way would point a common component at
 * route-group code.
 */
export function LanguageSwitcher<T extends string>({
	label,
	languages,
	selected,
	onSelect,
	disabled,
	className,
}: LanguageSwitcherProps<T>) {
	return (
		<div className={cn('flex items-center gap-2 mb-4', className)}>
			{label && <h3 className="font-bold whitespace-nowrap">{label}</h3>}
			{languages.map((language) => (
				<button
					key={language}
					type="button"
					aria-pressed={language === selected}
					disabled={disabled}
					onClick={() => onSelect(language)}
					className={cn(
						'rounded-md border px-3 py-1 text-sm transition-colors',
						language === selected
							? 'border-focus bg-accent-soft font-medium'
							: 'border-border opacity-70 hover:opacity-100',
						disabled && 'cursor-not-allowed opacity-50',
					)}
				>
					{language.toUpperCase()}
				</button>
			))}
		</div>
	);
}
