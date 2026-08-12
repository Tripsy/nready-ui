import { Tabs as HeroTabs } from '@heroui/react';
import type * as React from 'react';
import type { ReactNode } from 'react';

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
		<HeroTabs.List className={className} {...props}>
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
};

/**
 * The selection indicator is a react-aria `SelectionIndicator`: it renders inside
 * every tab and animates between them as a shared element, so it belongs here rather
 * than at the call sites (the parent toggles its visibility).
 */
const TabsTrigger = ({ children, ...props }: TabsTriggerProps) => (
	<HeroTabs.Tab {...props}>
		{children}
		<HeroTabs.Indicator />
	</HeroTabs.Tab>
);

const TabsContent = HeroTabs.Panel;

export { Tabs, TabsContent, TabsList, TabsTrigger };
