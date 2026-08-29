import { Tabs as HeroTabs } from '@heroui/react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/helpers/css.helper';

/**
 * Root — react-aria `Tabs`, keyed rather than valued: `defaultSelectedKey` /
 * `selectedKey` + `onSelectionChange`, with each tab and panel matched by `id`.
 */
const Tabs = HeroTabs;

type TabsListProps = React.ComponentProps<typeof HeroTabs.List> & {
	/**
	 * Applied to the container rather than the list. The segmented background and its
	 * rounding live there (`.tabs__list-container` sets `bg-default` and a raw
	 * `border-radius`), so shape and background overrides belong here — `rounded-*` on
	 * the list itself has nothing to override.
	 */
	containerClassName?: string;
};

/**
 * HeroUI splits the list into a container (the segmented background, plus overflow
 * chevrons that appear only when the tabs actually scroll) and the list itself.
 * `className` targets the list — padding, grid layout — and `containerClassName` the
 * container.
 */
const TabsList = ({
	children,
	className,
	containerClassName,
	...props
}: TabsListProps) => (
	<HeroTabs.ListContainer className={containerClassName}>
		{/*
		 * `p-2` widens HeroUI's own `p-1`, which leaves the selected tab's chip all but
		 * touching the segmented background around it. Set here so every tab strip in the
		 * app is spaced the same; a caller passing its own `p-*` still wins through `cn`.
		 */}
		<HeroTabs.List className={cn('p-2', className)} {...props}>
			{children}
		</HeroTabs.List>
	</HeroTabs.ListContainer>
);

// `children` is narrowed from HeroUI's render-prop union so the indicator can be
// appended; no call site uses the function form.
type TabsTriggerProps = Omit<
	React.ComponentProps<typeof HeroTabs.Tab>,
	'children'
> & {
	children?: ReactNode;
	/**
	 * Set false for a tab strip styled as plain text, where the sliding chip has no
	 * segmented background to travel along and just reads as a stray highlight.
	 */
	withIndicator?: boolean;
};

/**
 * The selection indicator is a react-aria `SelectionIndicator`: it renders inside every
 * tab and animates between them as a shared element, so it belongs here rather than at
 * the call sites.
 *
 * Dropped by not rendering it, rather than by hiding `.tabs__indicator` from a parent:
 * Tailwind reads `_` in an arbitrary variant as a space, so the selector for a BEM class
 * with a double underscore has to escape both to match — a silent no-op when it does not.
 */
const TabsTrigger = ({
	children,
	withIndicator = true,
	...props
}: TabsTriggerProps) => (
	<HeroTabs.Tab {...props}>
		{children}
		{withIndicator && <HeroTabs.Indicator />}
	</HeroTabs.Tab>
);

type TabsContentProps = React.ComponentProps<typeof HeroTabs.Panel>;

/**
 * Every panel stays in the DOM; an inactive one is hidden rather than removed.
 *
 * A submit reads the **DOM**: `processForm` rebuilds its values from the `FormData` the form
 * element yields, and a field that is not mounted is not in it. react-aria drops unselected
 * panels by default, so a tabbed form saved from one tab silently posts nothing for the fields
 * living on the others — the article form loses its categories, its reader-participation
 * switches and its dates that way, and the values it does not carry are then written over the
 * stored ones.
 *
 * Every `Tabs` in this app is inside a form, so force-mounting is the default here rather than a
 * per-call-site opt-in a new form has to know to ask for. The cost is the whole form rendering at
 * once, which these forms are small enough for. react-aria marks a force-mounted inactive panel
 * `inert` but leaves it visible, so the hiding is ours — the fields still submit, since only a
 * `disabled` control is left out of `FormData`.
 *
 * Anything that must survive a submit regardless can also ride in a hidden input outside the
 * tabs, which is what the per-language `contents` payload does.
 */
const TabsContent = ({ className, ...props }: TabsContentProps) => (
	<HeroTabs.Panel
		shouldForceMount
		className={cn('data-inert:hidden', className)}
		{...props}
	/>
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
