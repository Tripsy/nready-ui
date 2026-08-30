import type { BadgeVariant } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';

/** `get` is the only method that reads; everything else changes state, so it is colored. */
function methodVariant(method: string): BadgeVariant {
	switch (method.toLowerCase()) {
		case 'get':
			return 'info';
		case 'post':
			return 'success';
		case 'put':
		case 'patch':
			return 'warning';
		case 'delete':
			return 'error';
		default:
			return 'secondary';
	}
}

/**
 * The HTTP method of one documented endpoint.
 *
 * Its own module rather than a helper inside `api-docs.component.tsx`, because the catalog
 * page is a server component and that file is `'use client'` — importing from it would pull
 * the whole docs renderer across the boundary for a colored label.
 */
export function MethodBadge({ method }: { method: string }) {
	return (
		<Badge variant={methodVariant(method)} size="xs">
			{method.toUpperCase()}
		</Badge>
	);
}
