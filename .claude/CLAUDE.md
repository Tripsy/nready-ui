## Overview
Next.js app with codename `nready-ui` consuming the `nready-api` API. Public site (marketing, auth, account self-service) + admin CRUD dashboard for the backend entities.

Started as a copy of `../star-ui` (the frontend for `star-api`) with the fleet/CMR/driver features stripped out. `star-ui` is still the closest reference for anything not covered here.

## Tech Stack

- Runtime: Node.js v24 (Active LTS)
- Framework: Next.js v16.2
- Language: TypeScript v6.0.3
- Containerization: Docker

Versions above are current as of 2026-07. If a suggestion depends on version-specific
behavior, check pnpm-lock.yaml for the resolved version before assuming it applies.

**TypeScript stays on 6.x.** Next 16 rejects TS 7 at startup ("does not provide the compiler
API required by Next.js") and the dev server never comes up — the failure looks like a
hanging browser tab, not a version error. Do not bump the major without checking Next
supports it first.

## Role

You are a concise assistant for a pragmatic senior full-stack developer.
- Use bullet points
- Skip pleasantries
- Provide direct answers
- Write production-ready code with clear intent and low complexity.
- Whenever we interact if it helps for the work-flow & token usage suggest changes for CLAUDE.md

## Detailed Protocols (`.claude/rules/`)

These files carry the real conventions for their area. All are **path-scoped** via their `paths:`
frontmatter — they load only once a matching file is opened, so during planning they are not in
context yet. Read the relevant one *before* proposing an approach in that area, not after:

| File | Covers | Loads for |
|---|---|---|
| `forms.md` | Validators, `<entity>.definition.ts`, the `processForm` pipeline, both form hosts | form/definition/action files, form helpers |
| `data-fetching.md` | TanStack Query, service layer, query keys, cache invalidation | `src/services/**`, api helpers, data-table components |
| `state.md` | Zustand stores, what belongs in a store vs. local state vs. server cache | `src/stores/**`, `src/components/window/**` |
| `typescript.md` | TS/React conventions, linting rules, type-checking | every `.ts`/`.tsx` |

Backend behaviour has its own set in `../nready-api/.claude/rules/` (`api.md`, `auth.md`,
`database.md`, `error-handling.md`, `validation.md`, ...) — consult those rather than inferring
backend rules from this project.

## Rules & Conventions

- Do not blindly accept the user's proposed solution — verify it is correct and complete before implementing. If the approach has gaps, edge cases, or a better alternative exists, flag it.
- When the user describes a fix or approach, cross-check it against the actual codebase before writing code;
- **Prove behavioural claims by running the code, not by reading it.** There are no tests, so
  a runtime probe is the only evidence — and inspection routinely gets it wrong (a helper's
  own doc examples can be wrong, a regex can be unreachable). This applies to your own fix
  as much as to the bug: run it before saying it works.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- Prefer named exports for components
- Use TypeScript strict mode
- Follow the Next.js file-based routing conventions
- Use next/image for optimized images
- Use next/link for client-side navigation

## Coding Standards

- **Readability** over cleverness - code is read 10x more than written
- **Maintainability** - future developers (including yourself) should understand intent immediately
- **Error handling** - always consider edge cases and failure modes
- Prefer async/await over .then() chains
- Explicit error handling - no empty catch blocks
- Follow existing code conventions used in the project. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- The code should follow **best practices** and **design principles** like SOLID, KISS, DRY, and strong security standards.

## Code Comments

Comments are wanted — they carry what the code cannot say for itself, and they are the
reference both a future reader and a future session work from.

- **Describe the code as it is, never as a diff against what it was.** No "this used to run
  unconditionally", no "the previous order broke X", no "chose X over Y". State the constraint
  that still applies ("split before the lowercase, which destroys the case boundary the split
  reads") and leave the before/after for the commit message
- Not absolute: name a past state when it still constrains the present — a workaround an
  upstream bug requires, a shape kept for data already written — because a reader has to know
  it to change the code safely
- Note any performance implications or trade-offs

## Commands

Run inside the Docker container (`docker exec $DOCKER_CONTAINER`):

```bash
pnpm run dev      # Start dev server
pnpm run build    # Production build
pnpm run start    # Start production server (port 80)
pnpm run biome    # Biome check --write (lint + format + circular dependencies)
pnpm run clean    # Delete .next — Turbopack's dev cache grows until the container OOMs
```

**Start the dev server through `/dev-stack`**, not `docker exec -it … pnpm run dev` — it drives
this container and `nready-api.test` together, launches both detached, waits on their health
endpoints and writes `logs/dev.log` (gitignored). The driver is
`../nready-api/.claude/scripts/dev-stack.sh`; `/dev-stack doctor ui` reports the OOM flag and
memory headroom behind the cache growth noted above.

**pnpm 11 no longer reads the `pnpm` field in `package.json`** — settings live in
`pnpm-workspace.yaml`. A dependency whose install scripts are blocked reports
`ERR_PNPM_IGNORED_BUILDS` and pnpm writes a placeholder into `allowBuilds` there for you to
resolve; setting it in `package.json` is silently ignored with a warning. This matters for
anything whose postinstall fetches a binary (`@sentry/cli` downloads the uploader that
`next build` uses for source maps), because the build still succeeds without it and only the
downstream artefact is missing.

**`next build` rewrites `next-env.d.ts`** to reference `./.next/types/routes.d.ts`, where the
dev server writes `./.next/dev/types/routes.d.ts`. It therefore shows up as a modified file
after any build — a generated artefact, not a change to commit. `git checkout next-env.d.ts`
after building, or leave it for the dev server to flip back.

To spot-check a helper without a test suite, Node 24 runs TypeScript directly via type
stripping — `docker exec nready-ui.test sh -c "cd /var/www/html && node probe.ts"`, importing
the real module (`./src/helpers/x.helper.ts`). Type-only imports are erased, so a file whose
only `@/*` imports are `import type` resolves fine outside the path alias. This tests the
shipped source rather than a copy of it, which is the whole point — a hand-copied
reimplementation proves nothing about the code you are fixing.

To probe a file that imports `@/*` for *values*, Node needs a resolver hook — it does not read
`tsconfig` paths. Write a hook module exporting `resolve(specifier, context, next)` that maps
`@/x` to `/var/www/html/src/x` (trying `.ts`/`.tsx`/`/index.ts`, since the alias leaves the
extension implicit), register it from a second file via `register('./hook.mjs', pathToFileURL('/var/www/html/'))`,
and run `node --import ./register.mjs probe.ts`. Delete all three afterwards — probes live in
the scratchpad, not the repo. Prefer asserting through the module's public surface (call the
exported factory and exercise what it returns) over reaching for internals.

**After running `tsc` with the dev server stopped, `pnpm run clean` before restarting it.**
Otherwise the restarted dev server answers **404 for every route** — `/`, `/articles`,
`/dashboard/article` alike — with no compile step and nothing in the log, because it reads a
`.next` the type-check left inconsistent. It looks exactly like a routing bug in whatever you
just edited, which is what makes it expensive; observed twice.

The container is capped at 4g (`mem_limit` in `docker-compose.yml`) and Turbopack fills it.
If the dev server exits with nothing in the log it was SIGKILLed, not crashed — check
`docker inspect nready-ui.test --format '{{.State.OOMKilled}}'`, then `pnpm run clean` and
restart. There is not enough headroom for the dev server and a `build`/`tsc` at the same
time: stop the dev server before running either, or it is the one that gets killed.

## Context

- This FE project has **no database and holds no business logic of its own**
- It **sends no email** — the backend owns mail entirely. There is no nunjucks/templates stack here; don't reintroduce one.
- Nearly everything under `src/services/*.service.ts` is a typed wrapper around an `nready-api` REST endpoint.
- The backend project is located in `../nready-api` on which you have access through permission / additionalDirectories
- The two projects connect purely over HTTP
- `REMOTE_API_URL` in `.env` is the backend base URL.
- When a task requires understanding backend behavior — request/response shape, validation rules, permission
entities/operations, DB schema, business rules read the code in `../nready-api`
- `src/app/api/proxy/[...path]/route.ts` forwards dashboard requests to the backend, attaching the session
  cookie as a `Bearer` token.
- `src/proxy.ts` (the Next.js middleware) resolves auth/permission on every route by
  calling the backend's `/account/me` with the session token, then attaches the result as `x-auth-data`.
- `src/models/permission.model.ts` (`PermissionEntityType` / `PermissionOperationType`) mirrors the
  backend's permission entities — keep the two in sync when the backend adds/renames an entity.

## Project Structure

```
├── docker/
├── public/
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Admin panel routes (see "Per-entity dashboard CRUD pattern")
│   │   │   ├── _components/   # Dashboard-only components (side menu, data-table)
│   │   │   ├── _events/       # Cross-component events (data-table action / filter reset)
│   │   │   ├── _providers/    # data-table.provider.tsx (per-table store + Context)
│   │   │   ├── dashboard/     # One folder per entity
│   │   ├── (public)/          # Public site: marketing, auth, account
│   │   │   ├── _components/   # Public-only components (incl. account/ self-service windows)
│   │   │   ├── _hooks/
│   │   │   ├── _providers/
│   │   │   ├── account/       # Auth-entry flows + oauth/[provider] + me/
│   │   │   ├── page/
│   │   │   ├── status/
│   │   │   ├── layout.tsx     # Public specific layout
│   │   │   ├── loading.tsx
│   │   │   ├── page.tsx
│   │   ├── api/               # Route handlers
│   │   │   ├── csrf/
│   │   │   ├── health/
│   │   │   ├── image/
│   │   │   ├── language/
│   │   │   ├── oauth/         # oauth/[provider] — social login redirect/callback
│   │   │   ├── proxy/         # [...path] — forwards dashboard requests to nready-api
│   │   ├── error.tsx          # Route error boundary
│   │   ├── favicon.ico
│   │   ├── global-error.tsx   # Root-layout error boundary (inline-styled, no globals.css)
│   │   ├── globals.css
│   │   ├── layout.tsx         # Base layout
│   │   ├── providers.tsx      # Base providers
│   ├── components/            # Common components
│   │   ├── form/              # Form field components (form-element.component.tsx et al.)
│   │   ├── layout/            # Header, footer, logo, user menu, theme/language switchers
│   │   ├── ui/                # Thin wrappers over HeroUI primitives
│   │   ├── window/            # Modal/window stack + WindowForm
│   ├── config/                # Configuration files
│   │   ├── data-source.config.ts
│   │   ├── dayjs.config.ts
│   │   ├── init-redis.config.ts
│   │   ├── routes.setup.ts
│   │   ├── sentry.setup.ts
│   │   ├── settings.config.ts
│   │   ├── translate.setup.ts
│   ├── exceptions/            # Custom error classes
│   ├── helpers/               # Utilities (api, date, string, form, window, logger, etc.)
│   ├── hooks/                 # Custom hooks
│   ├── locales/               # Language files (en, ro)
│   ├── models/                # Models (entities)
│   ├── providers/             # auth, query-client, theme, toast, window-form, ...
│   ├── services/              # nready-api service wrappers (account, auth, image, ...)
│   ├── stores/
│   │   ├── data-table.store.ts
│   │   ├── window.store.ts
│   ├── types/
│   ├── instrumentation.ts     # + instrumentation-client.ts, sentry.{server,edge}.config.ts
│   └── proxy.ts               # Next.js middleware: auth, permissions, CSRF
├── .env
├── biome.json
├── docker-compose.yml
├── next.config.ts
└── tsconfig.json
```

## Restrictions

- This project has no tests at the moment.
- Do not run biome after applying change. Run it only on demand or before git push commands.
- Stop the dev server before running `build` or `tsc` — the container cannot hold both (see Commands).  
- **Never commit onto `main`.** GitHub refuses a direct push to it, so a commit made there has to be
  moved off before it can go anywhere. If the current branch is `main` when a commit is requested,
  create the branch first (`git switch -c <type>/<short-name>`) and commit on that. The same applies
  in `../nready-api`.
- When subagents are available and appropriate for the task, prefer delegating noisy operations
  (broad searches, log trawls, build output) to one — this is a preference for keeping the main
  context clean, not an instruction to spawn agents unprompted.

## Architecture

- **Dates and timezones** (`src/helpers/date.helper.ts`) — three deliberate conventions, don't
  "unify" them:
  1. *Typed times* mean the **user's device clock**. `combineDateAndTime` uses `setHours`,
     which resolves in the runtime zone, and these run client-side; serialising the Date gives
     the backend the right UTC instant.
  2. *Filter day-boundaries* mean **company time** — `toUTCISOString` reads its input as
     `app.timezone` so two managers in different countries filtering the same day get the same
     rows. This is the only place company time applies.
  3. *Display* is always the user's device zone, which happens for free: table and stats data
     is fetched client-side, so no timestamp is ever server-rendered (verified — the SSR HTML
     for `/dashboard` and `/dashboard/user` contains no formatted dates). Keep it that way; a
     date formatted in a server component would render in the container's UTC.
- **Route groups**: `src/app/(public)/*` is the public site (marketing/auth/account), and
  `src/app/(dashboard)/dashboard/*` is the admin panel — each has its own `layout.tsx`. Route access
  (`public` / `unauthenticated` / `authenticated` / `protected`, plus permission entity/operation) is
  declared centrally in `src/config/routes.setup.ts` via `Routes.group(...)`, not per-page — `src/proxy.ts`
  reads this table to redirect/authorize before a page ever renders.
- **Auth flow**: session token lives in an httpOnly cookie (`Configuration.get('user.sessionToken')`).
  `src/proxy.ts` middleware validates it against the backend on every matched request and injects the
  resulting `AuthModel` (user + `permissions` map) as the `x-auth-data` response header; `hasPermission()` in
  `src/models/auth.model.ts` gates `protected` routes. `src/providers/auth.provider.tsx` exposes this to
  client components.
- **Social login (OAuth)** — authorization-code flow split across two legs, both on this origin:
  1. *Start* — `src/app/api/oauth/[provider]/route.ts` (route `oauth-start`, `/api/oauth/:provider`).
     A GET route handler, not a server action, because the browser has to **navigate** to the
     provider; `OAuthProviders` (`(public)/_components/oauth-providers.component.tsx`) renders plain
     `<a>` links for that reason. It mints a `state` uuid, stores `{ state, from }` in the httpOnly
     `oauth-state` cookie (`sameSite: 'lax'` — a strict cookie would not survive the cross-site
     return), and redirects to the provider.
  2. *Callback* — the page is `(public)/account/oauth/[provider]/` (route `oauth-callback`,
     `/account/oauth/:provider`, must match `getOAuthRedirectUri`), but the work happens in the
     `POST /api/auth/oauth/:provider` route handler it calls through `requestOAuthCallback`. That
     handler consumes the cookie (single-use — deleted whether or not the check passes), compares
     `state`, then `requestOAuthLogin` → `writeSessionCookie`. The component redeems once behind a
     `useRef` guard, since Strict Mode would otherwise spend the single-use `code` twice.
     A route handler, not a server action: an action's response would re-render the callback page
     and reset both that guard and the `useState` holding the result.
  - **`state` is the entire CSRF defence for the provider round trip** and only this app can
     enforce it — the backend never sees the browser leave. The middleware's `x-csrf-token` gate
     cannot stand in for it: the start leg is a GET, so it is exempt. (The callback leg does pass
     that gate, being a mutating `/api/` request, but it protects this origin's endpoint, not the
     trip through the provider.) Don't "simplify" either leg into the other's shape.
  - The `from` return target rides in the cookie, never through the provider's `state`, and is
     validated against `isSafeReturnPath` / `isExcludedRoute` — a target that round-trips through a
     third party is one an attacker can rewrite.
  - Providers are declared in `src/types/oauth.type.ts` (`OAuthProviderEnum`, label map, per-provider
     authorize-URL builder). A provider is offered only when its `NEXT_PUBLIC_OAUTH_*_CLIENT_ID` is
     set; the backend holds the secret and answers 501 if it is not configured there too, so the two
     configs must agree. Adding a provider means a new enum entry, label, `buildOAuthAuthorizeUrl`
     case, `settings.config.ts` client id, and the matching backend `OAUTH_*` config.
  - Account-level linking/unlinking is separate from sign-in: `requestGetOAuthIdentities` /
     `requestUnlinkOAuth` (`account.service.ts`) behind `oauth-identity-list.component.tsx` on
     `/account/me`.
- **Backend calls only go through the proxy** (`src/app/api/proxy/[...path]/route.ts`) or, server-side,
  through `ApiRequest` (`src/helpers/api.helper.ts`) with `.setRequestMode('remote-api')` — this is what
  attaches auth headers and builds the backend URL from `REMOTE_API_URL`. Don't call the backend directly
  from client components.
- **Per-entity dashboard CRUD pattern**: every entity under `src/app/(dashboard)/dashboard/<entity>/` follows
  the same file set — `page.tsx`, `<entity>.definition.ts` (field/column defs), `data-table-<entity>.component.tsx`,
  `data-table-filters-<entity>.component.tsx`, `form-manage-<entity>.component.tsx`, `view-<entity>.component.tsx`.
  `data-source.config.ts` imports the definition **by path convention**, so the folder and the
  `<entity>.definition.ts` filename must both equal the `DataSourceKey` exactly.
  Adding a whole entity is a checklist of its own — run `/add-dashboard-feature <entity>`, which
  carries the backend-reading order and the full registration list.
- **Data tables**: list views use a shared `data-table` abstraction backed by `src/stores/data-table.store.ts`
  (Zustand); windows/dialogs are backed by `src/stores/window.store.ts` and `src/components/window`. The two
  stores differ in middleware and write style — read `.claude/rules/state.md` before editing either.
- **Config layer** (`src/config`): `settings.config.ts` (`Configuration.get(...)` — env-driven app settings,
  typed by dotted path so a typo is a compile error), `routes.setup.ts` (route table + auth),
  `data-source.config.ts` (maps `DataSourceKey` values to backend list/filter endpoints for data tables),
  `translate.setup.ts` (i18n), `init-redis.config.ts`.
- **Images**: `src/services/image.service.ts` / `image-storage.service.ts` handle upload/list/delete against
  the backend's `image` feature; storage backend is `local` or `s3` (`IMAGE_STORAGE` env var, `@aws-sdk/client-s3`).
- **Locales**: `src/locales/<lang>/*.json`, registered per-language in `src/locales/<lang>/index.ts`;
  `NEXT_PUBLIC_LANGUAGE_SUPPORTED` in `.env` controls which languages are active. Validation messages
  common to several entities live in `shared.json` (`shared.validation`); an entity spreads
  `sharedValidatorMessages` into its own key list and calls `resolveValidatorMessages()`
  (`src/helpers/validator.helper.ts`), which pulls the shared keys from `shared.validation` and the
  rest from `<entity>.validation`. Only genuinely entity-specific wording belongs in the latter.
- **CSRF**: enforced in `src/proxy.ts` for every mutating request under `/api/*`, by comparing the
  `x-csrf-token` header against the `x-csrf-secret` httpOnly cookie. `ApiRequest` attaches the header
  automatically (`src/helpers/csrf.helper.ts` owns the token and retries once on a `403` carrying the
  CSRF marker, since the cookie expires after an hour). A check inside a form handler cannot enforce
  anything — the form pipeline runs client-side — so keep the gate in the middleware. Server actions
  bypass it by design and rely on Next's own origin verification. This is the mechanism; what it means
  at the form layer (nothing to do, per-form CSRF options are wrong) is in `.claude/rules/forms.md` §1.
- **Money**: the backend stores amounts as separator-less integers scaled by `10 ** AMOUNT_DECIMALS`
  (4) — `cash-flow.service.ts` persists `Math.round(abs(amount) * 10000)` and divides back on read, so
  80.6452 is row value 806452. Forms accept 2 decimals; anything past the 4th is discarded by that
  round-trip. The VAT helpers in `src/helpers/string.helper.ts` round to the same precision — keep any
  new amount maths on `roundAmount()` rather than returning raw float.
- **Redis is shared with nready-api** (one instance, one database), so every key is namespaced by
  `redis.keyPrefix` (`nready-ui` here, `nready-api` there) inside `CacheProvider.buildKey`. Not via
  ioredis's own `keyPrefix` option: that one does not reach the MATCH argument of SCAN, so
  `deleteByPattern` would scan the other app's keys. Build every key through `buildKey`.
- **Logging** — never call `console.*` directly; use `logger` / `logRejection` from
  `src/helpers/logger.helper.ts` (the only file allowed to touch `console`). Signature is
  `(message, error?, context?)` — message first at every level, so a grouping backend can key on
  it. `debug` is dropped unless `NEXT_PUBLIC_APP_DEBUG=true`; the other levels always reach the
  console, because server-side that console *is* the sink (Docker captures stdout).
  `logger.helper.ts` reads `process.env` rather than `Configuration` on purpose: settings
  resolution logs through it, so importing it would close an import cycle.
  The transport is attached via `setLogReporter()` — the reason the helper imports no SDK. The
  backend's `log_data` is for business/audit events (`history`/`cron`/`system`); the dashboard
  reads it and must never write to it, and it has no create route.
- **Sentry** (`@sentry/nextjs`) — `src/config/sentry.setup.ts` owns the shared init options and the
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
- **What may go in a log context** — the third argument of a `logger` call is shipped to Sentry as
  `extra` (or as breadcrumb `data`), so it leaves the browser. Pass identifiers and shapes, never
  records or secrets: `{ key }`, `{ uid }`, `{ payloadLength }` — not the payload, not a user row.
  `sendDefaultPii` is off, and `beforeSend`/`beforeBreadcrumb` in `sentry.setup.ts` redact keys
  matching `/password|token|secret|authorization|cookie|credential/i`, but that is a backstop for
  the call site that slips through, not permission to rely on it.
- **Never call a server action from inside a form pipeline.** A server action is POSTed to the
  *current* URL and its response carries a re-rendered tree for that page. Applying that tree
  **resets the submitting form's state**: `useActionState` reverts to its initial value, so the
  result the action just returned is discarded, and the field values derived from it go with it.
  The scope is narrow, and worth knowing before ripping out unrelated actions: a server action
  called *outside* a form pipeline is fine. Measured on production — the `refreshAuth` interval
  in `auth.provider.tsx` fires `getAuth` every 10 minutes app-wide, and after one such call the
  React-rendered nodes were still attached and untouched, so the tree reconciles rather than
  remounts and ordinary `useState` survives. It is the nesting inside `useActionState` that
  destroys the result. A form that calls an action from its `operationFunction` therefore
  completes its work server-side and then comes back pristine — no message, no result, nothing
  to act on, and only a reload reveals that anything happened. Whatever the pipeline needs
  server-side goes in a **route handler under `/api/`** instead, which answers with plain JSON
  and no tree; `POST /api/auth/session` (`requestCreateSession`) exists for exactly this, and
  being a mutating `/api/` request it also passes the CSRF gate an action bypasses.
  The weaker form of the same problem hits navigation: applying that tree makes the action's URL
  canonical again, so a `router.push`/`replace` racing it is undone. `await`ing the action does
  not fix it — the promise resolves on the return value while the tree patch is a separate
  commit. Post-sign-in redirects therefore leave the page with `window.location.replace(...)`,
  which cannot be reverted, and the destination is server-rendered with the session cookie so
  `providers.tsx` seeds `AuthProvider` from `x-auth-data` with no `refreshAuth` needed
  (`login.component.tsx`, `oauth-callback.component.tsx`).
- **The dev server cannot validate auth changes.** Every bug in this area has been invisible
  locally: the tree-reset above only happens in the production React build, the redirect race
  resolves the *opposite* way when `/` is compiled on demand, and both `destroySession()` in
  `src/proxy.ts` and the backend's user-agent check on tokens are wrapped in
  `isEnvironment('production')`. A green local run is not evidence here — verify against a
  deployed build, and read state from the running page rather than inferring it.
- **Error boundaries**: `src/app/error.tsx` catches route errors, `src/app/global-error.tsx`
  catches failures in the root layout itself. The latter replaces that layout, so it gets no
  `globals.css` — it is inline-styled and dependency-free by design and must stay that way.
- **No `loading.tsx` above a route that can `notFound()`.** A `loading.tsx` is a Suspense
  boundary, and Next flushes the shell — status line included — the moment it reaches one. A
  `notFound()` that resolves after that still renders `not-found.tsx`, but the response is
  already committed as **200**, so a crawler is told the missing slug is a real page. This is
  why `(public)` has no `loading.tsx`: `/articles/:slug` and `/page/:label` both 404. Soft
  navigation still shows movement through `NavigationProgress`, mounted in the root layout.
  `(dashboard)/dashboard/loading.tsx` is fine — nothing under it calls `notFound()`. Verified
  by measuring the status both ways.
