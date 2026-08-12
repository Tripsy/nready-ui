import { Radio as HeroRadio, RadioGroup } from '@heroui/react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/helpers/css.helper';

/**
 * HeroUI's `.radio__control` sets `[border-width:var(--border-width-field)]`, which
 * resolves to `0` in this theme — an unselected radio is then just a `bg-field`
 * circle with no visible edge. Restoring a 1px `border-border` matches how inputs and
 * selects were fixed. The `data-selected` variant keeps HeroUI's `border-transparent`
 * on the filled state, so the accent circle keeps its clean edge.
 */
const controlBaseClass =
	'border border-border [[data-selected]_&]:border-transparent';

export type RadioProps = Omit<
	React.ComponentProps<typeof HeroRadio>,
	'children'
> & {
	/** Label content, rendered inside the clickable area next to the control. */
	children?: ReactNode;
	/** Applied to the clickable label row rather than the option container. */
	contentClassName?: string;
	/** Applied to the control (the circle) — see `ui/checkbox` for the width caveat. */
	controlClassName?: string;
};

/** Matches `ui/checkbox`: a caller-supplied border owns every state. */
const getControlClass = (controlClassName?: string) =>
	controlClassName ? cn('border', controlClassName) : controlBaseClass;

/**
 * Mirrors `ui/checkbox`: HeroUI's compound Radio composed into the single shape this
 * project uses. `Radio.Content` is the react-aria `RadioButton` — it renders the
 * `<label>` and owns the click target, so the option's text is passed as `children`
 * rather than as a separate `<Label htmlFor>` sibling.
 */
const Radio = ({
	children,
	contentClassName,
	controlClassName,
	...props
}: RadioProps) => (
	<HeroRadio {...props}>
		<HeroRadio.Content className={contentClassName}>
			<HeroRadio.Control className={getControlClass(controlClassName)}>
				<HeroRadio.Indicator />
			</HeroRadio.Control>
			{children}
		</HeroRadio.Content>
	</HeroRadio>
);

export { Radio, RadioGroup };
