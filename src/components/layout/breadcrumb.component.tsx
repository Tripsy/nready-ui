import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

export type BreadcrumbItem = {
	label: string;
	/** Omitted on the current page, which is rendered as plain text. */
	href?: string;
};

/**
 * The trail shared by the dashboard and the public site: a home icon followed by the path to
 * the current page.
 *
 * Presentational only - where the items come from differs per surface (the dashboard reads a
 * provider its pages write to, a public page knows its own trail at render time), so each
 * keeps a small wrapper of its own and this holds the markup they agree on.
 *
 * No `'use client'`: with no hooks of its own it renders on the server for the public pages
 * and folds into the client bundle when the dashboard's wrapper imports it.
 *
 * The last item is never a link, whether or not it carries an `href`: it is where the reader
 * already is.
 */
export function Breadcrumb({
	items,
	homeHref,
	className,
}: {
	items: BreadcrumbItem[];
	/** Where the home icon points - the dashboard root, or the site root. */
	homeHref: string;
	className?: string;
}) {
	if (!items.length) {
		return null;
	}

	return (
		<nav aria-label="Breadcrumb" className={className}>
			<ul className="flex flex-wrap items-center gap-1.5 text-sm">
				<li>
					<Link
						href={homeHref}
						className="flex items-center text-muted hover:text-foreground transition-colors"
					>
						<Home className="h-4 w-4" />
					</Link>
				</li>

				{items.map((item, index) => (
					<li
						key={`breadcrumb-${item.label}`}
						className="flex items-center gap-1.5"
					>
						<ChevronRight className="h-4 w-4 text-muted" />

						{item.href && index < items.length - 1 ? (
							<Link
								href={item.href}
								className="text-muted hover:text-foreground transition-colors"
							>
								{item.label}
							</Link>
						) : (
							<span className="text-foreground font-medium">
								{item.label}
							</span>
						)}
					</li>
				))}
			</ul>
		</nav>
	);
}
