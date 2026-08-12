/**
 * The single entry point for diagnostics, replacing direct `console.*` calls.
 *
 * Two runtimes share it. Server-side (route handlers, middleware, server components) the
 * console *is* the sink — Docker captures stdout — so console output is unconditional
 * rather than dev-only. Client-side the console is only visible to whoever has devtools
 * open, which is why a reporter can be attached to forward the same entry somewhere
 * durable.
 *
 * Env is read straight from `process.env` rather than through `Configuration`: settings
 * resolution logs its own misses through this module, so importing it would close an
 * import cycle (`noImportCycles`) — and a logger that needs working config to report a
 * config failure is a logger that goes quiet exactly when it is needed.
 */

export const LogLevelEnum = {
	DEBUG: 'debug',
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error',
} as const;

export type LogLevel = (typeof LogLevelEnum)[keyof typeof LogLevelEnum];

/** Structured detail attached to an entry — anything a grouping backend can index on. */
export type LogContext = Record<string, unknown>;

export type LogEntry = {
	readonly level: LogLevel;
	readonly message: string;
	readonly error?: unknown;
	readonly context?: LogContext;
};

/**
 * Forwards an entry beyond the console. Registered at startup by whatever owns the
 * transport, so this module carries no dependency on it.
 */
export type LogReporter = (entry: LogEntry) => void;

let reporter: LogReporter | null = null;

/**
 * Attach (or with `null`, detach) the transport. Called once from the instrumentation
 * entry points; keeping it a registration rather than a static import means the helper
 * stays importable from edge middleware and server components without dragging an SDK
 * into those bundles.
 */
export function setLogReporter(nextReporter: LogReporter | null): void {
	reporter = nextReporter;
}

// Same flag `Configuration.get('app.debug')` resolves, read directly — see the module note.
const isDebug = process.env.NEXT_PUBLIC_APP_DEBUG === 'true';

/**
 * Level to `console` method. Held as a *name* and resolved at call time on purpose:
 * capturing the function reference at module load would pin whatever `console` looked like
 * during import, and both Next's dev overlay and Sentry's console integration replace those
 * methods afterwards.
 */
const consoleMethod: Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'> = {
	[LogLevelEnum.DEBUG]: 'debug',
	[LogLevelEnum.INFO]: 'info',
	[LogLevelEnum.WARN]: 'warn',
	[LogLevelEnum.ERROR]: 'error',
};

function writeToConsole({ level, message, error, context }: LogEntry): void {
	// Passed as separate arguments rather than interpolated so devtools keeps the error
	// expandable and the context inspectable instead of flattening both to `[object Object]`.
	const details: unknown[] = [];

	if (error !== undefined) {
		details.push(error);
	}

	if (context !== undefined) {
		details.push(context);
	}

	console[consoleMethod[level]](`[${level}] ${message}`, ...details);
}

function emit(entry: LogEntry): void {
	// Debug is developer commentary, not a diagnostic — it stays off unless asked for.
	if (entry.level === LogLevelEnum.DEBUG && !isDebug) {
		return;
	}

	writeToConsole(entry);

	if (!reporter) {
		return;
	}

	try {
		reporter(entry);
	} catch (reporterError: unknown) {
		// Deliberately a raw `console.error`: routing a transport failure back through
		// `emit` would call the same broken transport again, and recurse.
		console.error('[logger] Reporter failed:', reporterError);
	}
}

/**
 * `message` first at every level, so the line reads the same everywhere and a reporter can
 * group on it. `error` is `unknown` because a `catch` binding is.
 */
export const logger = {
	debug: (message: string, error?: unknown, context?: LogContext): void =>
		emit({ level: LogLevelEnum.DEBUG, message, error, context }),

	info: (message: string, error?: unknown, context?: LogContext): void =>
		emit({ level: LogLevelEnum.INFO, message, error, context }),

	warn: (message: string, error?: unknown, context?: LogContext): void =>
		emit({ level: LogLevelEnum.WARN, message, error, context }),

	error: (message: string, error?: unknown, context?: LogContext): void =>
		emit({ level: LogLevelEnum.ERROR, message, error, context }),
};

/**
 * Ready-made `.catch()` handler for a promise nothing awaits.
 *
 * `promise.catch(console.error)` reports the rejection with no indication of which call
 * produced it — in a provider that fires several refreshes on a timer, that is an
 * anonymous stack. `promise.catch(logRejection('Auth refresh failed'))` names the site.
 */
export function logRejection(
	message: string,
	context?: LogContext,
): (error: unknown) => void {
	return (error: unknown): void => {
		logger.error(message, error, context);
	};
}
