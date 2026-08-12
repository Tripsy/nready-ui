import * as Sentry from '@sentry/nextjs';

/**
 * Next's server-side startup hook. The two runtimes need different SDK builds, so each is
 * loaded dynamically and only in the runtime it belongs to — a static import would pull the
 * Node build into the edge bundle, where its dependencies do not resolve.
 */
export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		await import('./sentry.server.config');
	}

	if (process.env.NEXT_RUNTIME === 'edge') {
		await import('./sentry.edge.config');
	}
}

/**
 * Reports errors thrown while rendering server components, and in middleware. These never
 * pass through a `catch`, so `logger` cannot see them — this hook is what makes them
 * visible, and is why it is wired even though the reporter covers logged failures.
 */
export const onRequestError = Sentry.captureRequestError;
