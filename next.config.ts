import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	trailingSlash: false,
	output: 'standalone', // Recommended for Amplify
	allowedDevOrigins: ['star-ui.test'],
	// reactStrictMode: false,
	experimental: {
		// nodeMiddleware: true,

		/*
		 * Keep Turbopack under the container's 4g `mem_limit` (docker-compose.yml).
		 * Without a target it grows until the cgroup OOM killer SIGKILLs next-server —
		 * which looks like the dev server silently exiting, with nothing in the log.
		 * 3 GiB leaves headroom for the Node process itself around Turbopack's arena.
		 *
		 * Note this bounds memory, not the on-disk `.next/dev/cache`, which still grows
		 * across sessions — `pnpm run clean` drops it when startup RSS creeps back up.
		 */
		turbopackMemoryLimit: 3 * 1024 * 1024 * 1024,
	},
};

export default withSentryConfig(nextConfig, {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,

	// Build-time only, and absent on a dev machine — without it the build still succeeds,
	// it just skips the source map upload and stack traces stay minified.
	authToken: process.env.SENTRY_AUTH_TOKEN,

	sourcemaps: {
		// Maps are uploaded to Sentry, then removed from the output. `output: 'standalone'`
		// would otherwise ship them into the image, where they are publicly fetchable and
		// hand anyone the unminified source.
		deleteSourcemapsAfterUpload: true,
	},

	// Client events POST to this app's own origin, which then forwards them. Ad blockers
	// routinely drop requests to sentry.io outright, and a report that never arrives is
	// indistinguishable from no error. The route is outside `/api/`, so the CSRF gate in
	// `src/proxy.ts` does not apply, and a same-origin POST satisfies its origin check.
	tunnelRoute: '/sentry-tunnel',

	// Covers bundles Next emits outside the default upload scope, so a stack trace through
	// a shared chunk is not left half-symbolicated.
	widenClientFileUpload: true,

	silent: !process.env.CI,
});
