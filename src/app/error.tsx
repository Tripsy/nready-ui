'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorComponent } from '@/components/status.component';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { logger } from '@/helpers/logger.helper';

export default function ErrorBoundary({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		logger.error('Route boundary caught an error', error, {
			digest: error.digest,
		});
	}, [error]);

	return (
		<ErrorComponent description={error.message}>
			<div className="mt-8 text-center">
				<Button onClick={() => reset()}>Try Again</Button> or go back to
				the{' '}
				<Link href={Routes.get('home')} className="underline link">
					home page
				</Link>
			</div>
		</ErrorComponent>
	);
}
