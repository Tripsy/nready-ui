'use client';

import { useEffect } from 'react';
import { logger } from '@/helpers/logger.helper';

/**
 * Last-resort boundary for errors thrown by the root layout itself — which `error.tsx`
 * cannot catch, because it renders *inside* that layout. Until this file existed such a
 * failure fell through to Next's built-in page and was reported nowhere.
 *
 * It replaces the root layout wholesale, so it owns `<html>`/`<body>` and gets none of the
 * `globals.css` Tailwind that layout imports. Everything here is therefore inline and
 * dependency-free by design: the one thing this component must never do is fail for the
 * same reason the tree below it did.
 */
export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		logger.error('Root layout crashed', error, { digest: error.digest });
	}, [error]);

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '1.5rem',
					colorScheme: 'light dark',
					fontFamily:
						'system-ui, -apple-system, "Segoe UI", sans-serif',
				}}
			>
				<main style={{ maxWidth: '32rem', textAlign: 'center' }}>
					<h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem' }}>
						Something went wrong
					</h1>

					<p style={{ margin: '0 0 1.5rem', lineHeight: 1.5 }}>
						The page could not be loaded. Trying again often
						resolves it.
					</p>

					{/* Production builds redact the message, leaving the digest as the only
					    handle support can match against a report. */}
					{error.digest && (
						<p
							style={{
								margin: '0 0 1.5rem',
								fontFamily: 'monospace',
								fontSize: '0.8125rem',
								opacity: 0.7,
							}}
						>
							Reference: {error.digest}
						</p>
					)}

					<button
						type="button"
						onClick={() => reset()}
						style={{
							padding: '0.5rem 1.25rem',
							fontSize: '1rem',
							cursor: 'pointer',
							borderRadius: '0.375rem',
							border: '1px solid currentColor',
							background: 'transparent',
							color: 'inherit',
						}}
					>
						Try again
					</button>
				</main>
			</body>
		</html>
	);
}
