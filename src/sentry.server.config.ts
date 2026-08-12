import * as Sentry from '@sentry/nextjs';
import {
	isSentryEnabled,
	registerSentryReporter,
	sentryInitOptions,
} from '@/config/sentry.setup';

// Node runtime — route handlers, server components, server actions. Loaded by
// `instrumentation.ts` when `NEXT_RUNTIME` is `nodejs`.
if (isSentryEnabled()) {
	Sentry.init(sentryInitOptions());

	registerSentryReporter();
}
