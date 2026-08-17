'use client';

import { useBreadcrumb } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import { Breadcrumb as BreadcrumbLayout } from '@/components/layout/breadcrumb.component';
import Routes from '@/config/routes.setup';

/**
 * The dashboard's trail: the shared breadcrumb fed from the provider its pages write to.
 *
 * `breadcrumb-container` is what `globals.css` keys the responsive placement on — the header
 * copy hides below `md`, the one inside the main section shows there — so it stays on this
 * wrapper rather than moving into the shared component, which knows nothing of the dashboard
 * layout.
 */
export const Breadcrumb = () => {
	const { items } = useBreadcrumb();

	return (
		<BreadcrumbLayout
			items={items}
			homeHref={Routes.get('dashboard')}
			className="breadcrumb-container"
		/>
	);
};
