---
paths:
  - "src/config/sentry.setup.ts"
  - "src/sentry.server.config.ts"
  - "src/sentry.edge.config.ts"
  - "src/instrumentation.ts"
  - "src/instrumentation-client.ts"
  - "src/helpers/logger.helper.ts"
---

# Observability — logger, Sentry, log context

## Logger

Never call `console.*` directly; use `logger` / `logRejection` from
`src/helpers/logger.helper.ts` (the only file allowed to touch `console`). Signature is
`(message, error?, context?)` — message first at every level, so a grouping backend can key on
it. `debug` is dropped unless `NEXT_PUBLIC_APP_DEBUG=true`; the other levels always reach the
console, because server-side that console *is* the sink (Docker captures stdout).
`logger.helper.ts` reads `process.env` rather than `Configuration` on purpose: settings
resolution logs through it, so importing it would close an import cycle.
The transport is attached via `setLogReporter()` — the reason the helper imports no SDK. The
backend's `log_data` is for business/audit events (`history`/`cron`/`system`); the dashboard
reads it and must never write to it, and it has no create route.

## Sentry

`@sentry/nextjs`. `src/config/sentry.setup.ts` owns the shared init options and the
`LogEntry` → Sentry mapping (`debug`/`info` become breadcrumbs, `warn`/`error` become events);
the three runtime entry points (`src/sentry.server.config.ts`, `src/sentry.edge.config.ts`,
`src/instrumentation-client.ts`) only call it. Edge is what covers `src/proxy.ts`.
`src/instrumentation.ts` loads the server/edge config per `NEXT_RUNTIME` and exports
`onRequestError`, which catches server-component and middleware errors that never reach a
`catch` and so are invisible to `logger`. Everything is gated on `NEXT_PUBLIC_SENTRY_DSN` — empty
means no `init` at all. Client events tunnel through `/sentry-tunnel` on this origin (set in
`next.config.ts`) to survive ad blockers; that path deliberately sits outside `/api/`, so the
CSRF gate in `proxy.ts` does not apply and it matches no entry in `routes.setup.ts`.
Session replay is off on purpose — bundle weight, and it records user/client input.

## What may go in a log context

The third argument of a `logger` call is shipped to Sentry as
`extra` (or as breadcrumb `data`), so it leaves the browser. Pass identifiers and shapes, never
records or secrets: `{ key }`, `{ uid }`, `{ payloadLength }` — not the payload, not a user row.
`sendDefaultPii` is off, and `beforeSend`/`beforeBreadcrumb` in `sentry.setup.ts` redact keys
matching `/password|token|secret|authorization|cookie|credential/i`, but that is a backstop for
the call site that slips through, not permission to rely on it.
