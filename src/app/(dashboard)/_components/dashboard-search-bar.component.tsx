'use client';

import { useCallback, useRef, useState } from 'react';
import {
	filterSideMenuSections,
	SideMenuSearchField,
	SideMenuSearchResults,
	useDismissOnOutsidePress,
} from '@/app/(dashboard)/_components/side-menu-search.component';
import { useSideMenuSections } from '@/app/(dashboard)/_hooks/use-side-menu-sections.hook';
import { useBreadcrumb } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { useTranslation } from '@/hooks/use-translation.hook';

const SEARCH_TRANSLATION_KEYS = [
	'dashboard.text.label_menu_search',
	'dashboard.text.placeholder_menu_search',
	'dashboard.text.label_menu_search_clear',
	'dashboard.text.no_menu_entries',
] as const;

/**
 * The mobile search bar — its own sticky band directly under the header, repeating that
 * header's surface, gutters and row height so the two read as one. The input is always
 * visible and the matches drop over the page beneath it.
 *
 * Its height is what `globals.css` offsets the mobile sidebar by, so a change to the row here
 * needs the matching `top-*`/`h-*` there.
 *
 * `top-16` pins it below the header, which is `top-0` and exactly that tall; `z-50` matches
 * the header rather than the drawer's `z-40`, so the results still cover an open drawer.
 *
 * It sits in a file of its own because the dashboard layout — a server component — imports it
 * directly. That makes this a client entry, where Next allows only serializable props on the
 * components a file exports; the pieces it builds on take callbacks, so they stay in
 * `side-menu-search.component.tsx`, which no server component imports.
 */
export function DashboardSearchBar() {
	const { sections } = useSideMenuSections();
	const { selectedPage } = useBreadcrumb();
	const { translations } = useTranslation(SEARCH_TRANSLATION_KEYS);

	const [query, setQuery] = useState('');

	const containerRef = useRef<HTMLDivElement>(null);

	const clear = useCallback(() => setQuery(''), []);

	const isSearching = query.trim() !== '';

	useDismissOnOutsidePress(isSearching, [containerRef], clear);

	const results = filterSideMenuSections(sections, query);

	return (
		<div className="sticky top-16 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:hidden">
			<div className="container-dashboard mx-4">
				<div
					ref={containerRef}
					className="relative flex items-center h-16"
				>
					<SideMenuSearchField
						value={query}
						onValueChange={setQuery}
						onEscape={clear}
						className="w-full"
						label={translations['dashboard.text.label_menu_search']}
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

					{isSearching && (
						<nav
							aria-label={
								translations['dashboard.text.label_menu_search']
							}
							className="absolute inset-x-0 top-full max-h-[60vh] overflow-y-auto rounded-b-lg border border-border bg-overlay p-1 text-overlay-foreground shadow-md"
						>
							<SideMenuSearchResults
								sections={results}
								selectedPage={selectedPage}
								emptyText={
									translations[
										'dashboard.text.no_menu_entries'
									]
								}
								onNavigate={clear}
							/>
						</nav>
					)}
				</div>
			</div>
		</div>
	);
}
