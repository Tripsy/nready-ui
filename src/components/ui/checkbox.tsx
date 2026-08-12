import { Checkbox as HeroCheckbox } from '@heroui/react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/helpers/css.helper';

/**
 * HeroUI's `.checkbox__control` sets `[border-width:var(--border-width-field)]`, which
 * resolves to `0` in this theme — an unchecked box is then just a `bg-field` square
 * with no visible edge. Restoring a 1px `border-border` matches how inputs and selects
 * were fixed. The `data-selected` variant keeps HeroUI's `border-transparent` on the
 * checked state, so the accent fill keeps its clean edge.
 */
const controlBaseClass =
	'border border-border [[data-selected]_&]:border-transparent';

export type CheckboxProps = Omit<
	React.ComponentProps<typeof HeroCheckbox>,
	'children'
> & {
	/** Label content, rendered inside the clickable area next to the control. */
	children?: ReactNode;
	/** Applied to the clickable label row rather than the field container. */
	contentClassName?: string;
	/**
	 * Applied to the control (the square) — this is where field-state borders go.
	 * Overrides the default border in *every* state, checked included, so the state
	 * colour stays visible; supply a border *width* utility (`border`) alongside the
	 * colour, since the HeroUI default resolves to `0`.
	 */
	controlClassName?: string;
};

/**
 * Wraps HeroUI's compound Checkbox in the one composition this project uses:
 * a control with the default checkmark indicator, followed by the label content.
 *
 * `Checkbox.Content` is the react-aria `CheckboxButton` — it renders the `<label>`
 * and owns the click target, so callers pass label content as `children` instead of
 * wrapping the checkbox in their own `<Label>` (which nested one label inside another).
 */
const Checkbox = ({
	children,
	contentClassName,
	controlClassName,
	...props
}: CheckboxProps) => {
	// A caller-supplied border owns every state, so the checked-state transparency
	// is dropped there — it would otherwise out-specify the state colour.
	const controlClass = controlClassName
		? cn('border', controlClassName)
		: controlBaseClass;

	return (
		<HeroCheckbox {...props}>
			<HeroCheckbox.Content className={contentClassName}>
				<HeroCheckbox.Control className={controlClass}>
					<HeroCheckbox.Indicator />
				</HeroCheckbox.Control>
				{children}
			</HeroCheckbox.Content>
		</HeroCheckbox>
	);
};

export { Checkbox };
