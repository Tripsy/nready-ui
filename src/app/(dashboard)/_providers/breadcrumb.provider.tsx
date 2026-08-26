'use client';

import { usePathname } from 'next/navigation';
import { createContext, type ReactNode, useContext, useState } from 'react';
import type { BreadcrumbItem } from '@/components/layout/breadcrumb.component';
import type { DataSourceKey } from '@/types/data-source.key';

/**
 * Alias of the shared breadcrumb's item, kept under this name because every dashboard page
 * types its trail with it. The shape is declared once, next to the component that renders it.
 */
export type BreadcrumbType = BreadcrumbItem;
export type SelectedPageType = DataSourceKey | null;

const BreadcrumbContext = createContext<
	| {
			selectedPage: SelectedPageType;
			setSelectedPage: (selectedPage: SelectedPageType) => void;
			items: BreadcrumbType[];
			setItems: (items: BreadcrumbType[]) => void;
	  }
	| undefined
>(undefined);

const BreadcrumbProvider = ({ children }: { children: ReactNode }) => {
	const [selectedPage, setSelectedPage] = useState<SelectedPageType>(null);
	const [items, setItems] = useState<BreadcrumbType[]>([]);

	const pathname = usePathname();
	const [renderedPathname, setRenderedPathname] = useState(pathname);

	/*
	 * The trail and the highlighted menu entry belong to one route, but only the pages that
	 * have something to say mount a `BreadcrumbSetter` — `/dashboard` itself does not. Both
	 * values are therefore cleared here whenever the route changes, and a page that wants
	 * them writes them back.
	 *
	 * Deliberately during render rather than in an effect: effects run children-first, so an
	 * effect here would fire *after* the incoming page's setter and wipe what it just wrote.
	 * Setting state of this same component while rendering it is the supported way to reset
	 * state on a prop change — React re-renders this subtree before committing, so no child
	 * ever sees the stale value.
	 */
	if (pathname !== renderedPathname) {
		setRenderedPathname(pathname);
		setSelectedPage(null);
		setItems([]);
	}

	return (
		<BreadcrumbContext.Provider
			value={{ selectedPage, setSelectedPage, items, setItems }}
		>
			{children}
		</BreadcrumbContext.Provider>
	);
};

function useBreadcrumb() {
	const context = useContext(BreadcrumbContext);

	if (context === undefined) {
		throw new Error(
			'useBreadcrumb must be used within a BreadcrumbProvider',
		);
	}

	return context;
}

export { BreadcrumbContext, BreadcrumbProvider, useBreadcrumb };
