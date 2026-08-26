'use client';

import { ArrowDown, ArrowRight } from 'lucide-react';
import NextLink from 'next/link';
import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	filterSideMenuSections,
	SideMenuSearchField,
	SideMenuSearchRail,
	SideMenuSearchResults,
} from '@/app/(dashboard)/_components/side-menu-search.component';
import {
	type SideMenuSectionType,
	useSideMenuSections,
} from '@/app/(dashboard)/_hooks/use-side-menu-sections.hook';
import {
	type SelectedPageType,
	useBreadcrumb,
} from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { useSideMenu } from '@/app/(dashboard)/_providers/side-menu.provider';
import { LinkPendingIcon } from '@/components/link-pending-icon.component';
import { Link } from '@/components/ui/link';
import Routes from '@/config/routes.setup';
import { cn } from '@/helpers/css.helper';
import { useDebouncedEffect } from '@/hooks/use-debounced-effect.hook';
import { useTranslation } from '@/hooks/use-translation.hook';

type SideMenuOpenSectionProps = SideMenuSectionType & {
	selectedPage: SelectedPageType;
};

type SideMenuClosedSectionProps = SideMenuSectionType & {
	selectedPage: SelectedPageType;
};

type SectionStateType = 'expanded' | 'collapsed';

const SEARCH_TRANSLATION_KEYS = [
	'dashboard.text.label_menu_search',
	'dashboard.text.placeholder_menu_search',
	'dashboard.text.label_menu_search_clear',
	'dashboard.text.no_menu_entries',
] as const;

export function SideMenu() {
	const { menuState } = useSideMenu();
	const { selectedPage } = useBreadcrumb();
	const { sections } = useSideMenuSections();
	const { translations } = useTranslation(SEARCH_TRANSLATION_KEYS);

	const [query, setQuery] = useState('');

	// Collapsing the sidebar hands the search over to the rail flyout, which starts empty;
	// leaving a stale query behind would filter the tree that reappears on the next expand.
	useEffect(() => {
		if (menuState === 'closed') {
			setQuery('');
		}
	}, [menuState]);

	const isSearching = menuState === 'open' && query.trim() !== '';

	const menuContent = useMemo(() => {
		if (menuState === 'open') {
			return sections.map((section) => (
				<SideMenuOpenSection
					key={`side-menu-section-${section.label}`}
					selectedPage={selectedPage}
					{...section}
				/>
			));
		}

		return sections.map((section) => (
			<SideMenuClosedSection
				key={`side-menu-section-${section.label}`}
				selectedPage={selectedPage}
				{...section}
			/>
		));
	}, [sections, menuState, selectedPage]);

	return (
		<div className="side-menu-container">
			<div className="flex flex-col h-full">
				{menuState === 'open' ? (
					/*
					 * Hidden on mobile: the drawer only opens under a header that already
					 * carries the search bar, and two inputs for one menu is one too many.
					 *
					 * The right gutter is the wider one because the scrollbar belongs to the
					 * scrolling nav below, not to this row — matching the left padding here
					 * would leave the field running into it.
					 */
					<div className="hidden md:block pl-3 pr-5 pt-4">
						<SideMenuSearchField
							value={query}
							onValueChange={setQuery}
							label={
								translations['dashboard.text.label_menu_search']
							}
							placeholder={
								translations[
									'dashboard.text.placeholder_menu_search'
								]
							}
							clearLabel={
								translations[
									'dashboard.text.label_menu_search_clear'
								]
							}
						/>
					</div>
				) : (
					<div className="flex justify-center px-2 pt-4">
						<SideMenuSearchRail
							sections={sections}
							selectedPage={selectedPage}
						/>
					</div>
				)}

				<nav aria-description="Side menu" className="side-menu-content">
					{isSearching ? (
						<SideMenuSearchResults
							sections={filterSideMenuSections(sections, query)}
							selectedPage={selectedPage}
							emptyText={
								translations['dashboard.text.no_menu_entries']
							}
						/>
					) : (
						menuContent
					)}
				</nav>

				{menuState === 'open' && (
					<div className="p-4 border-t border-sidebar-border">
						<div className="rounded-lg bg-sidebar-accent p-4">
							<p className="text-sm font-medium text-sidebar-accent-foreground mb-1">
								Need help?
							</p>
							<p className="text-xs text-muted mb-3">
								Check our documentation for guidance.
							</p>
							<Link
								size="sm"
								variant="secondary"
								className="w-full"
								href={Routes.get('docs')}
								title="Check out the documentation"
							>
								View Docs
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function SideMenuOpenSection({
	isExpanded = false,
	label,
	text,
	items,
	selectedPage,
}: SideMenuOpenSectionProps) {
	const keyStorageSectionState = `side-menu-section-state-${label}`;

	const [sectionState, setSectionState] = useState<SectionStateType>(() =>
		isExpanded ? 'expanded' : 'collapsed',
	);

	useLayoutEffect(() => {
		const storageSectionState: string | null = localStorage.getItem(
			keyStorageSectionState,
		);

		if (
			storageSectionState !== null &&
			storageSectionState !== 'undefined'
		) {
			setSectionState(storageSectionState as SectionStateType);
		}
	}, [keyStorageSectionState]);

	useDebouncedEffect(
		() => {
			localStorage.setItem(keyStorageSectionState, sectionState);
		},
		[sectionState],
		1000,
	);

	const toggleSectionState = (e: React.MouseEvent<HTMLElement>) => {
		e.preventDefault();

		setSectionState((previousState) =>
			previousState === 'expanded' ? 'collapsed' : 'expanded',
		);
	};

	if (items.length === 0) {
		return null;
	}

	return (
		<div>
			<button
				type="button"
				onClick={toggleSectionState}
				className="flex items-center text-left gap-2 px-3 py-2.5 w-full transition-all duration-200 text-sidebar-foreground hover:bg-sidebar-accent"
			>
				{sectionState === 'expanded' ? (
					<ArrowDown className="h-4 w-4 shrink-0" />
				) : (
					<ArrowRight className="h-4 w-4 shrink-0" />
				)}
				<span className="flex-1 truncate">{text}</span>
			</button>
			<div
				className={cn(
					'transition-all duration-300 ease-in-out',
					sectionState === 'expanded'
						? 'max-h-96 opacity-100 translate-y-0'
						: 'max-h-0 opacity-0 -translate-y-2 overflow-hidden',
				)}
			>
				<ul className="ml-6 py-1">
					{items.map((item) => (
						<li key={`side-menu-item-${item.page}`}>
							<NextLink
								href={item.href}
								className={cn(
									'flex items-center text-left gap-2 px-3 py-2 transition-all duration-200 group',
									selectedPage === item.page
										? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
										: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
								)}
							>
								<LinkPendingIcon
									icon={item.icon}
									className="h-4 w-4 shrink-0"
								/>{' '}
								{item.text}
							</NextLink>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function SideMenuClosedSection({
	text,
	icon: SectionIcon,
	items,
	selectedPage,
}: SideMenuClosedSectionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});
	const triggerRef = useRef<HTMLDivElement>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const openFlyout = () => {
		if (closeTimer.current) {
			clearTimeout(closeTimer.current);
		}
		const rect = triggerRef.current?.getBoundingClientRect();
		if (rect) {
			setPosition({ top: rect.top, left: rect.right });
		}
		setIsOpen(true);
	};

	// Small delay so the pointer can travel across the gap into the flyout.
	const closeFlyout = () => {
		closeTimer.current = setTimeout(() => setIsOpen(false), 120);
	};

	useEffect(
		() => () => {
			if (closeTimer.current) {
				clearTimeout(closeTimer.current);
			}
		},
		[],
	);

	if (items.length === 0) {
		return null;
	}

	const isSelected: boolean = items.some(
		(item) => item.page === selectedPage,
	);

	const flyout = items.map((item) => (
		<li key={`side-menu-item-${item.page}`}>
			<NextLink
				href={item.href}
				className={cn(
					'flex items-center text-left gap-2 px-3 py-2 rounded-md transition-all duration-200 group',
					selectedPage === item.page
						? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
				)}
			>
				<LinkPendingIcon
					icon={item.icon}
					className="h-4 w-4 shrink-0"
				/>{' '}
				{item.text}
			</NextLink>
		</li>
	));

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover-reveal flyout container (mouse-only, mirrors prior collapsed-sidebar behaviour)
		<div
			ref={triggerRef}
			onMouseEnter={openFlyout}
			onMouseLeave={closeFlyout}
		>
			<div
				className={cn(
					'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group cursor-default',
					isSelected
						? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
						: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
				)}
				aria-description={text}
			>
				<SectionIcon
					className={cn(
						'h-5 w-5 shrink-0',
						isSelected && 'text-sidebar-primary',
					)}
				/>
			</div>

			{/*
			 * Interactive hover flyout for the collapsed sidebar. Rendered in a portal so it
			 * escapes the sidebar's overflow-clipping; positioned to the right of the icon.
			 * (A tooltip role can't hold links, and HeroUI has no hover-card.)
			 */}
			{isOpen &&
				createPortal(
					// biome-ignore lint/a11y/noStaticElementInteractions: hover-bridge wrapper that keeps the flyout open while the pointer is over it
					<div
						className="fixed z-50 pl-2"
						style={{ top: position.top, left: position.left }}
						onMouseEnter={openFlyout}
						onMouseLeave={closeFlyout}
					>
						<nav
							aria-label={text}
							className="min-w-48 rounded-lg border border-border bg-overlay text-overlay-foreground shadow-md p-1 animate-fade-in"
						>
							<ul className="py-1">{flyout}</ul>
						</nav>
					</div>,
					document.body,
				)}
		</div>
	);
}
