import * as Sentry from '@sentry/nextjs';
import { Configuration } from '@/config/settings.config';
import { type LogEntry, setLogReporter } from '@/helpers/logger.helper';

/**
 * Sentry wiring shared by the three runtimes (`sentry.server.config`, `sentry.edge.config`,
 * `instrumentation-client`). Each of those files is a runtime entry point Next loads on its
 * own; they differ only in which integrations the SDK resolves, so the options and the
 * reporter live here rather than being repeated three times and drifting.
 */

/** Whether a DSN is configured at all. Everything below is a no-op without one. */
export function isSentryEnabled(): boolean {
	return Configuration.get('sentry.dsn') !== '';
}

/**
 * Context keys redacted on the way out. The test is on the key *name*, the same approach
 * `window-draft.helper.ts` takes for form drafts, so a newly added credential field is
 * covered by default rather than by someone remembering to extend a list.
 *
 * A backstop, not the primary defence: `extra` is assembled by `logger` call sites all over
 * the app, and the rule there is still to never put a secret or a personal record in a log
 * context. This catches the one that eventually slips through.
 */
const REDACTED_CONTEXT_PATTERN =
	/password|token|secret|authorization|cookie|credential/i;

const REDACTED_PLACEHOLDER = '[redacted]';

function redactByKey(
	values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!values) {
		return values;
	}

	for (const key of Object.keys(values)) {
		if (REDACTED_CONTEXT_PATTERN.test(key)) {
			values[key] = REDACTED_PLACEHOLDER;
		}
	}

	return values;
}

export function sentryInitOptions(): Sentry.NodeOptions &
	Sentry.BrowserOptions {
	return {
		dsn: Configuration.get('sentry.dsn'),
		environment: Configuration.environment(),
		tracesSampleRate: Configuration.get('sentry.tracesSampleRate'),

		// Off deliberately. The default would attach IP addresses and request headers to
		// every event, and this app handles driver and client records — anything Sentry
		// needs for triage should be an explicit `context` on the log call instead.
		sendDefaultPii: false,

		// The SDK's own console chatter, not ours.
		debug: false,

		beforeSend: (event) => {
			event.extra = redactByKey(event.extra);

			return event;
		},

		// Breadcrumbs carry `context` from `debug`/`info` entries and ship attached to the
		// event, so they need the same pass as `extra`.
		beforeBreadcrumb: (breadcrumb) => {
			breadcrumb.data = redactByKey(breadcrumb.data);

			return breadcrumb;
		},
	};
}

/**
 * Maps a `LogEntry` onto Sentry's model:
 *
 * - `debug`/`info` become breadcrumbs. They describe what led up to a failure and would
 *   otherwise burn event quota describing things that went right.
 * - `warn`/`error` become events. Where a real `Error` was passed it is reported as an
 *   exception, so Sentry groups by its stack rather than by our message; the call-site
 *   message rides along as `logMessage`, since the stack alone rarely says which of a
 *   helper's callers was involved.
 */
function reportToSentry({ level, message, error, context }: LogEntry): void {
	if (level === 'debug' || level === 'info') {
		Sentry.addBreadcrumb({
			level,
			message,
			data: context,
		});

		return;
	}

	const sentryLevel = level === 'warn' ? 'warning' : 'error';

	if (error instanceof Error) {
		Sentry.captureException(error, {
			level: sentryLevel,
			extra: { logMessage: message, ...context },
		});

		return;
	}

	// No `Error` to group on — either the level carried none, or something non-Error was
	// thrown. The message is then the only stable identity the event has.
	Sentry.captureMessage(message, {
		level: sentryLevel,
		extra:
			error === undefined ? context : { thrownValue: error, ...context },
	});
}

/**
 * Attaches the reporter, so everything already routed through `logger` reaches Sentry
 * without a single call site importing the SDK. Sentry's own unhandled-error and
 * unhandled-rejection handlers stay in place alongside this and cover what never passes
 * through a `catch`.
 */
export function registerSentryReporter(): void {
	if (!isSentryEnabled()) {
		return;
	}

	setLogReporter(reportToSentry);
}
