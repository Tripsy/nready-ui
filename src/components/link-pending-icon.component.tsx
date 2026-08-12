'use client';

import { useLinkStatus } from 'next/link';
import type { ComponentType } from 'react';
import { LoadingIcon } from '@/components/status.component';

type LinkPendingIconProps = {
	icon: ComponentType<{ className?: string }>;
	className?: string;
};

/**
 * Swaps a link's icon for a spinner while that link's navigation is in flight.
 *
 * Must be rendered inside a `next/link` <Link> — that is the only place `useLinkStatus()`
 * has a status to read. It flips to `pending` on the click itself, so unlike a route-level
 * `loading.tsx` fallback it needs no bytes from the server: it tells the user *which* link
 * is loading during the request that precedes the fallback.
 *
 * Swapping the icon rather than appending a spinner keeps the row width stable, so menus
 * don't shift while loading.
 */
export function LinkPendingIcon({
	icon: Icon,
	className,
}: LinkPendingIconProps) {
	const { pending } = useLinkStatus();

	return pending ? (
		<LoadingIcon className={className} />
	) : (
		<Icon className={className} />
	);
}
