import { Button } from '@/components/ui/button';
import { cn } from '@/helpers/css.helper';

type ManagerLanguageSwitcherProps<T extends string> = {
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
 * below show, and those fields are the same in every language - there is no per-language
 * panel of its own for a tab to describe.
 *
 * Common rather than dashboard-scoped because `manager-images` uses it too, and that lives in
 * `src/components`; an import reaching the other way would point a common component at
 * route-group code.
 */
export function ManagerLanguageSwitcher<T extends string>({
	label,
	languages,
	selected,
	onSelect,
	disabled,
	className,
}: ManagerLanguageSwitcherProps<T>) {
	return (
		<div className={cn('flex items-center gap-2 mb-4', className)}>
			{label && <h3 className="font-bold whitespace-nowrap">{label}</h3>}
			{languages.map((language) => (
				<Button
					key={language}
					variant="outline"
					size="xs"
					aria-pressed={language === selected}
					disabled={disabled}
					onClick={() => onSelect(language)}
					className={cn(
						'relative font-semibold uppercase transition-all duration-200 rounded-md',
						language === selected
							? 'bg-warning/80 text-warning-foreground hover:text-warning-foreground hover:bg-warning/70'
							: 'hover:text-warning-foreground hover:bg-warning/50 hover:shadow-sm',
					)}
					aria-label={language.toUpperCase()}
				>
					{language}
				</Button>
			))}
		</div>
	);
}
