'use client';

import NextLink from 'next/link';
import type { JSX } from 'react';
import Routes from '@/config/routes.setup';

/**
 * Opens one client's ledger: the page reads `client_id` from the query and adopts it as its
 * client filter (`DataTableFiltersClientLedger`).
 *
 * Rendered inside a data-table row, so the press stops here instead of selecting the row - the
 * same reason `DisplayButton` gives in `data-table-value.tsx`.
 */
export function LinkClientLedger({
	clientId,
	label,
}: {
	clientId: number;
	label: string;
}): JSX.Element {
	return (
		<NextLink
			href={`${Routes.get('client-ledger')}?client_id=${clientId}`}
			className="hover:underline"
			onPointerDown={(event) => event.stopPropagation()}
			onMouseDown={(event) => event.stopPropagation()}
			onClick={(event) => event.stopPropagation()}
		>
			{label}
		</NextLink>
	);
}
