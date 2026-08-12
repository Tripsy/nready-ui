import * as Sentry from '@sentry/nextjs';
import {
	isSentryEnabled,
	registerSentryReporter,
	sentryInitOptions,
} from '@/config/sentry.setup';

/*
 * Edge runtime — this is what covers `src/proxy.ts`, which resolves auth and CSRF on every
 * matched request and is therefore the one place a failure affects every route at once.
 * Next runs middleware on the edge runtime unless `experimental.nodeMiddleware` is on, so
 * the server config above never loads for it.
 */
if (isSentryEnabled()) {
	Sentry.init(sentryInitOptions());

	registerSentryReporter();
}
