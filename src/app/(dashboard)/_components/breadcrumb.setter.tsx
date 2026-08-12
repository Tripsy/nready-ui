'use client';

import { useEffect } from 'react';
import {
	type BreadcrumbType,
	type SelectedPageType,
	useBreadcrumb,
} from '@/app/(dashboard)/_providers/breadcrumb.provider';

export default function BreadcrumbSetter({
	page,
	items,
}: {
	page: SelectedPageType;
	items: BreadcrumbType[];
}) {
	const { setItems, setSelectedPage } = useBreadcrumb();

	useEffect(() => {
		setItems(items);
	}, [items, setItems]);

	useEffect(() => {
		setSelectedPage(page);
	}, [page, setSelectedPage]);

	return null;
}
