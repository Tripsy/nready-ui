import * as Sentry from '@sentry/nextjs';
import {
	isSentryEnabled,
	registerSentryReporter,
	sentryInitOptions,
} from '@/config/sentry.setup';

/*
 * Browser runtime. Next loads this before any application code, which is what lets the
 * reporter be in place before the first component renders — including `global-error.tsx`,
 * whose whole purpose is to catch a root layout that never got that far.
 *
 * Session replay is deliberately not enabled: it is the largest addition to the client
 * bundle and it records user input, which on the driver panel means real client and
 * consignment data leaving the browser.
 */
if (isSentryEnabled()) {
	Sentry.init(sentryInitOptions());

	registerSentryReporter();
}

/** Lets Sentry tie spans to App Router navigations rather than to the initial page load. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
