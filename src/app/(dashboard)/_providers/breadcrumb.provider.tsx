'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import type { DataSourceKey } from '@/types/data-source.key';

export type BreadcrumbType = { label: string; href?: string };
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
