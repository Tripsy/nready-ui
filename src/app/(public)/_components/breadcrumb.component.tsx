import {
	type BreadcrumbItem,
	Breadcrumb as BreadcrumbLayout,
} from '@/components/layout/breadcrumb.component';
import Routes from '@/config/routes.setup';

export type { BreadcrumbItem };

/**
 * The public trail: the shared breadcrumb with the home icon pointing at the site root.
 *
 * A wrapper rather than a direct import at each call site, so the one thing every public page
 * agrees on - where "home" is - is stated once.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
	return <BreadcrumbLayout items={items} homeHref={Routes.get('home')} />;
}
