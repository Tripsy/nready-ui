'use client';

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
