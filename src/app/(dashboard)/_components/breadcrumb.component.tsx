'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { useBreadcrumb } from '@/app/(dashboard)/_providers/breadcrumb.provider';
import Routes from '@/config/routes.setup';

export const Breadcrumb = () => {
	const { items } = useBreadcrumb();

	if (!items.length) {
		return;
	}

	return (
		<nav aria-label="Breadcrumb" className="breadcrumb-container">
			<ul className="flex items-center gap-1.5 text-sm">
				<li>
					<Link
						href={Routes.get('dashboard')}
						className="flex items-center text-muted hover:text-foreground transition-colors"
					>
						<Home className="h-4 w-4" />
					</Link>
				</li>
				{items.map((item, index) => (
					<li
						key={`nav-breadcrumb-${item.label}`}
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
};
