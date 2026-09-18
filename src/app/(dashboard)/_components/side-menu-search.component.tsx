/*
 * No `'use client'`, and it must stay that way. The directive marks a boundary, and everything
 * a client module imports is already in the client graph - but Next's TS plugin treats any file
 * carrying it as a client *entry* and then rejects every non-serializable prop on the
 * components that file exports (TS71007), which the callbacks below are. Only the two
 * components a server file mounts declare the boundary: `side-menu.component.tsx` and
 * `dashboard-search-bar.component.tsx`. Importing this file from a server component would
 * therefore be a mistake with no directive left to catch it.
 */

import NextLink from 'next/link';
import {
	type ChangeEvent,
	type KeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { SideMenuSectionType } from '@/app/(dashboard)/_hooks/use-side-menu-sections.hook';
import type { SelectedPageType } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { Icons } from '@/components/icon.component';
import { LinkPendingIcon } from '@/components/link-pending-icon.component';
import { cn } from '@/helpers/css.helper';
import { useTranslation } from '@/hooks/use-translation.hook';

const SEARCH_TRANSLATION_KEYS = [
	'dashboard.text.label_menu_search',
	'dashboard.text.placeholder_menu_search',
	'dashboard.text.label_menu_search_clear',
	'dashboard.text.no_menu_entries',
] as const;

/**
 * Case- and diacritic-insensitive form of a label, so "reclamatii" matches "Reclamații".
 * NFD splits an accented letter into base + combining mark, which the `\p{Diacritic}` class
 * then removes; the Romanian locale is why this is not a plain `toLowerCase()`.
 */
function normalizeSearchText(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();
}

/**
 * Narrows the menu tree to what matches `query`. A section whose own label matches keeps all
 * of its items - searching for "logs" is a request for the whole group, not only for an item
 * that happens to repeat the word.
 */
export function filterSideMenuSections(
	sections: SideMenuSectionType[],
	query: string,
): SideMenuSectionType[] {
	const needle = normalizeSearchText(query.trim());

	if (needle === '') {
		return sections;
	}

	return sections
		.map((section) => {
			if (normalizeSearchText(section.text).includes(needle)) {
				return section;
			}

			return {
				...section,
				items: section.items.filter((item) =>
					normalizeSearchText(item.text).includes(needle),
				),
			};
		})
		.filter((section) => section.items.length > 0);
}

/**
 * Closes a floating panel on a pointer press outside every element in `refs`.
 *
 * Takes a list rather than one node because the collapsed rail's panel is portalled to
 * `document.body`: it is part of the widget but not part of the trigger's DOM subtree, so a
 * single `contains()` check would treat a click inside the panel as a click outside.
 */
export function useDismissOnOutsidePress(
	isOpen: boolean,
	refs: RefObject<HTMLElement | null>[],
	onDismiss: () => void,
) {
	// Read inside the listener so a caller may pass the array inline without re-subscribing.
	const refsRef = useRef(refs);
	refsRef.current = refs;

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const onPointerDown = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node;

			if (refsRef.current.some((ref) => ref.current?.contains(target))) {
				return;
			}

			onDismiss();
		};

		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('touchstart', onPointerDown);

		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('touchstart', onPointerDown);
		};
	}, [isOpen, onDismiss]);
}

type SideMenuSearchFieldProps = {
	value: string;
	onValueChange: (value: string) => void;
	/** Escape on an already-empty field - the hosts that can close use it to close. */
	onEscape?: () => void;
	label: string;
	placeholder: string;
	clearLabel: string;
	autoFocus?: boolean;
	className?: string;
};

/**
 * The search input itself - icon on the left, clear button on the right once there is
 * something to clear. Presentational: each host owns its own query state, since the three
 * placements (open sidebar, collapsed rail flyout, mobile header) open and close separately.
 */
export function SideMenuSearchField({
	value,
	onValueChange,
	onEscape,
	label,
	placeholder,
	clearLabel,
	autoFocus = false,
	className,
}: SideMenuSearchFieldProps) {
	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		onValueChange(event.target.value);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== 'Escape') {
			return;
		}

		if (value !== '') {
			onValueChange('');

			return;
		}

		onEscape?.();
	};

	return (
		<div className={cn('relative', className)}>
			<Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />

			<input
				type="text"
				value={value}
				onChange={onChange}
				onKeyDown={onKeyDown}
				// biome-ignore lint/a11y/noAutofocus: only set by the rail flyout, which exists solely because the user just asked to type in it
				autoFocus={autoFocus}
				aria-label={label}
				placeholder={placeholder}
				className="h-10 w-full rounded-md border border-border bg-field pl-9 pr-9 text-sm text-field-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
			/>

			{value !== '' && (
				<button
					type="button"
					onClick={() => onValueChange('')}
					aria-label={clearLabel}
					className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted transition-colors hover:text-foreground"
				>
					<Icons.Close className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}

type SideMenuSearchResultsProps = {
	sections: SideMenuSectionType[];
	selectedPage: SelectedPageType;
	emptyText: string;
	onNavigate?: () => void;
	className?: string;
};

/**
 * The matches, flattened to one list: with the tree already narrowed, collapsible section
 * headers would only hide results. The section label rides along on each row so an item whose
 * name is ambiguous on its own ("Order") stays identifiable.
 */
export function SideMenuSearchResults({
	sections,
	selectedPage,
	emptyText,
	onNavigate,
	className,
}: SideMenuSearchResultsProps) {
	if (sections.length === 0) {
		return (
			<p className={cn('px-3 py-4 text-sm text-muted', className)}>
				{emptyText}
			</p>
		);
	}

	return (
		<ul className={cn('py-1', className)}>
			{sections.flatMap((section) =>
				section.items.map((item) => (
					<li key={`side-menu-search-item-${item.page}`}>
						<NextLink
							href={item.href}
							onClick={onNavigate}
							className={cn(
								'flex items-center gap-2 rounded-md px-3 py-2 text-left transition-all duration-200',
								selectedPage === item.page
									? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
									: 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
							)}
						>
							<LinkPendingIcon
								icon={item.icon}
								className="h-4 w-4 shrink-0"
							/>
							<span className="flex-1 truncate">{item.text}</span>
							<span className="shrink-0 text-xs text-muted">
								{section.text}
							</span>
						</NextLink>
					</li>
				)),
			)}
		</ul>
	);
}

type SideMenuSearchRailProps = {
	sections: SideMenuSectionType[];
	selectedPage: SelectedPageType;
};

/**
 * The collapsed sidebar's search: an accented icon button on the rail that slides a panel out
 * to its right, holding the input and the matches.
 *
 * The panel is portalled for the same reason the collapsed sections' flyouts are - the rail is
 * 4rem wide and clips its overflow, so a panel rendered inside it would be cut off.
 */
export function SideMenuSearchRail({
	sections,
	selectedPage,
}: SideMenuSearchRailProps) {
	const { translations } = useTranslation(SEARCH_TRANSLATION_KEYS);

	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});

	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	const close = useCallback(() => {
		setIsOpen(false);
		setQuery('');
	}, []);

	useDismissOnOutsidePress(isOpen, [triggerRef, panelRef], close);

	const toggle = () => {
		if (isOpen) {
			close();

			return;
		}

		const rect = triggerRef.current?.getBoundingClientRect();

		if (rect) {
			setPosition({ top: rect.top, left: rect.right });
		}

		setIsOpen(true);
	};

	const results = filterSideMenuSections(sections, query);

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={toggle}
				aria-expanded={isOpen}
				aria-label={translations['dashboard.text.label_menu_search']}
				className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-warning/60 hover:text-accent-foreground transition-colors duration-200 hover:bg-warning-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
			>
				<Icons.Search className="h-5 w-5 shrink-0" />
			</button>

			{isOpen &&
				createPortal(
					<div
						ref={panelRef}
						className="fixed z-50 pl-2"
						style={{ top: position.top, left: position.left }}
					>
						<div className="w-72 animate-slide-in-left rounded-lg border border-border bg-overlay p-2 text-overlay-foreground shadow-md">
							<SideMenuSearchField
								value={query}
								onValueChange={setQuery}
								onEscape={close}
								autoFocus
								label={
									translations[
										'dashboard.text.label_menu_search'
									]
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

							<nav
								aria-label={
									translations[
										'dashboard.text.label_menu_search'
									]
								}
								className="mt-2 max-h-[60vh] overflow-y-auto"
							>
								<SideMenuSearchResults
									sections={results}
									selectedPage={selectedPage}
									emptyText={
										translations[
											'dashboard.text.no_menu_entries'
										]
									}
									onNavigate={close}
								/>
							</nav>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
