## Overview
Next.js app with codename `nready-ui` consuming the `nready-api` API. Public site (marketing, auth, account self-service) + admin CRUD dashboard for the backend entities.

Started as a copy of `../star-ui` (the frontend for `star-api`) with the fleet/CMR/driver features stripped out. `star-ui` is still the closest reference for anything not covered here.

## TypeScript version

**TypeScript stays on 6.x.** Next 16 rejects TS 7 at startup ("does not provide the compiler
API required by Next.js") and the dev server never comes up - the failure looks like a
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
frontmatter - they load only once a matching file is opened, so during planning they are not in
context yet. Read the relevant one *before* proposing an approach in that area, not after:

| File | Covers | Loads for |
|---|---|---|
| `forms.md` | Validators, `<entity>.definition.ts`, the `processForm` pipeline, both form hosts, server actions vs. the pipeline, creating a related record from a form | form/definition/action files, form helpers |
| `data-fetching.md` | TanStack Query, service layer, query keys, cache invalidation | `src/services/**`, api helpers, data-table components |
| `state.md` | Zustand stores, what belongs in a store vs. local state vs. server cache | `src/stores/**`, `src/components/window/**` |
| `comment.md` | The public comment/rating/report widgets: translations across the server boundary, per-visitor reads, comment anchors | `src/components/{comment,complaint,rating}/**` |
| `typescript.md` | TS/React conventions, linting rules, type-checking | every `.ts`/`.tsx` |
| `oauth.md` | The two-leg social-login flow, the `state`/`oauth-state` CSRF contract, adding a provider | `src/app/api/oauth/**`, `src/app/(public)/account/oauth/**`, `oauth.type.ts` |
| `observability.md` | `logger` internals, the Sentry init/mapping layer, the tunnel route | `sentry.setup.ts`, `sentry.*.config.ts`, `instrumentation*.ts`, `logger.helper.ts` |
| `locales.md` | Translation files, the shared vs. entity-specific validation-message split | `src/locales/**`, `validator.helper.ts` |
| `images.md` | The upload/list/delete services and the `local`/`s3` storage backends | `src/services/image*.ts`, `manager-images.component.tsx` |
| `money.md` | The scaled-integer amount format the backend stores, and `roundAmount()` | `cash-flow.service.ts`, `string.helper.ts` |
| `dates.md` | The three timezone conventions (device clock, company time, display) | `date.helper.ts` |
| `dependencies.md` | pnpm 11 settings location, `allowBuilds` for install scripts | `package.json`, `pnpm-workspace.yaml` |
| `redis.md` | Key namespacing in a Redis instance shared with `nready-api` | `cache.provider.ts`, `auth-cache.helper.ts`, `init-redis.config.ts` |

Backend behaviour has its own set in `../nready-api/.claude/rules/` (`api.md`, `auth.md`,
`database.md`, `error-handling.md`, `validation.md`, ...) - consult those rather than inferring
backend rules from this project.

## Rules & Conventions

- Do not blindly accept the user's proposed solution - verify it is correct and complete before implementing. If the approach has gaps, edge cases, or a better alternative exists, flag it.
- When the user describes a fix or approach, cross-check it against the actual codebase before writing code;
- **Prove behavioural claims by running the code, not by reading it.** There are no tests, so
  a runtime probe is the only evidence - and inspection routinely gets it wrong (a helper's
  own doc examples can be wrong, a regex can be unreachable). This applies to your own fix
  as much as to the bug: run it before saying it works.
- Prefer named exports for components
- Use next/image for optimized images
- Use next/link for client-side navigation

## Code Comments

Comments are wanted - they carry what the code cannot say for itself, and they are the
reference both a future reader and a future session work from.

- **Describe the code as it is, never as a diff against what it was.** No "this used to run
  unconditionally", no "the previous order broke X", no "chose X over Y". State the constraint
  that still applies ("split before the lowercase, which destroys the case boundary the split
  reads") and leave the before/after for the commit message
- Not absolute: name a past state when it still constrains the present - a workaround an
  upstream bug requires, a shape kept for data already written - because a reader has to know
  it to change the code safely
- Note any performance implications or trade-offs
- **Write prose in en-US** - `authorize`, `normalize`, `serialize`, `behavior`, `organization`,
  `canceled`. This covers comments, commit messages and user-facing copy.
- **No em dashes (U+2014) anywhere in the repo** - use a plain hyphen `-` instead, spaced
  as ` - `. Applies to comments, doc blocks, markdown, commit messages and user-facing
  copy.

## Commands

Run inside the Docker container (`docker exec $DOCKER_CONTAINER`):

```bash
pnpm run dev      # Start dev server
pnpm run build    # Production build
pnpm run start    # Start production server (port 80)
pnpm run biome    # Biome check --write (lint + format + circular dependencies)
pnpm run clean    # Delete .next - Turbopack's dev cache grows until the container OOMs
```

**Start the dev server through `/dev-stack`**, not `docker exec -it … pnpm run dev` - it drives
this container and `nready-api.test` together, launches both detached, waits on their health
endpoints and writes `logs/dev.log` (gitignored). The driver is
`../nready-api/.claude/scripts/dev-stack.sh`; `/dev-stack doctor ui` reports the OOM flag and
memory headroom behind the cache growth noted above.

**`next build` rewrites `next-env.d.ts`** to reference `./.next/types/routes.d.ts`, where the
dev server writes `./.next/dev/types/routes.d.ts`. It therefore shows up as a modified file
after any build - a generated artefact, not a change to commit. `git checkout next-env.d.ts`
after building, or leave it for the dev server to flip back.

To prove a behavioural claim without a test suite, run a throwaway probe against the real source
- `/probe-runtime` carries the recipes: Node 24 type-stripping in the container, the resolver
hook a module importing `@/*` for *values* needs, and the targeted `tsconfig.probe.json` that
type-checks a subset without stopping the dev server. Probes go in the repo (it is the only
path mounted into the container) under the gitignored `__probe-*` / `tsconfig.probe.json` names.

**After running `tsc` with the dev server stopped, `pnpm run clean` before restarting it.**
Otherwise the restarted dev server answers **404 for every route** - `/`, `/articles`,
`/dashboard/article` alike - with no compile step and nothing in the log, because it reads a
`.next` the type-check left inconsistent. It looks exactly like a routing bug in whatever you
just edited, which is what makes it expensive; observed twice.

If the dev server dies silently or every route answers 404/500, it was likely SIGKILLed - run
`/dev-stack`, which carries the memory-cap and OOM diagnosis.

There is not enough headroom for the dev server and a `build`/full `tsc` at the same time: stop the
dev server before running either, or it is the one that gets killed. A **targeted** `tsc` is the
exception - a `tsconfig.probe.json` with an explicit `files` list costs little, writes nothing to
`.next`, and so needs neither a stopped dev server nor a `clean` (`/probe-runtime`).

## Context

- This FE project has **no database and holds no business logic of its own**
- It **sends no email** - the backend owns mail entirely. There is no nunjucks/templates stack here; don't reintroduce one.
- Nearly everything under `src/services/*.service.ts` is a typed wrapper around an `nready-api` REST endpoint.
- The backend project is located in `../nready-api` on which you have access through permission / additionalDirectories
- The two projects connect purely over HTTP
- `REMOTE_API_URL` in `.env` is the backend base URL.
- When a task requires understanding backend behavior - request/response shape, validation rules, permission
entities/operations, DB schema, business rules read the code in `../nready-api`
- `src/models/permission.model.ts` (`PermissionEntityType` / `PermissionOperationType`) mirrors the
  backend's permission entities - keep the two in sync when the backend adds/renames an entity.

## Restrictions

- This project has no tests at the moment.
- Do not run biome after applying change. Run it only on demand or before git push commands.
- **Never commit onto `main`.** GitHub refuses a direct push to it, so a commit made there has to be
  moved off before it can go anywhere. If the current branch is `main` when a commit is requested,
  create the branch first (`git switch -c <type>/<short-name>`) and commit on that. The same applies
  in `../nready-api`.
- When subagents are available and appropriate for the task, prefer delegating noisy operations
  (broad searches, log trawls, build output) to one - this is a preference for keeping the main
  context clean, not an instruction to spawn agents unprompted.

## Architecture

- **Dates**: never format a date in a server component - it renders in the container's UTC. The
  three timezone conventions (device clock / company time / display) are in `.claude/rules/dates.md`.
- **Route groups**: `src/app/(public)/*` is the public site (marketing/auth/account), and
  `src/app/(dashboard)/dashboard/*` is the admin panel - each has its own `layout.tsx`. Route access
  (`public` / `unauthenticated` / `authenticated` / `protected`, plus permission entity/operation) is
  declared centrally in `src/config/routes.setup.ts` via `Routes.group(...)`, not per-page - `src/proxy.ts`
  reads this table to redirect/authorize before a page ever renders.
- **Auth flow**: session token lives in an httpOnly cookie (`Configuration.get('user.sessionToken')`).
  `src/proxy.ts` middleware validates it against the backend on every matched request and injects the
  resulting `AccountModel` (user + `permissions` map) as the `x-auth-data` response header; `hasPermission()` in
  `src/models/account.model.ts` gates `protected` routes. `src/providers/auth.provider.tsx` exposes this to
  client components.
- **Social login (OAuth)** - authorization-code flow across two legs on this origin:
  `/api/oauth/:provider` starts it, `/account/oauth/:provider` redeems the code. The `state` uuid
  carried in the httpOnly `oauth-state` cookie is the entire CSRF defence for the provider round
  trip - the middleware's `x-csrf-token` gate cannot stand in for it. Both legs are route
  handlers, not server actions, and neither may be reshaped into the other.
  Details: `.claude/rules/oauth.md`.
- **Backend calls only go through the proxy** (`src/app/api/proxy/[...path]/route.ts`) or, server-side,
  through `ApiRequest` (`src/helpers/api.helper.ts`) with `.setRequestMode('remote-api')` - this is what
  attaches auth headers and builds the backend URL from `REMOTE_API_URL`. Don't call the backend directly
  from client components.
- **Per-entity dashboard CRUD pattern**: every entity under `src/app/(dashboard)/dashboard/<entity>/` follows
  the same file set - `page.tsx`, `<entity>.definition.ts` (field/column defs), `data-table-<entity>.component.tsx`,
  `data-table-filters-<entity>.component.tsx`, `form-manage-<entity>.component.tsx`, `view-<entity>.component.tsx`.
  `data-source.config.ts` imports the definition **by path convention**, so the folder and the
  `<entity>.definition.ts` filename must both equal the `DataSourceKey` exactly.
  Adding a whole entity is a checklist of its own - run `/add-dashboard-feature <entity>`, which
  carries the backend-reading order and the full registration list.
- **Data tables**: list views use a shared `data-table` abstraction backed by `src/stores/data-table.store.ts`
  (Zustand); windows/dialogs are backed by `src/stores/window.store.ts` and `src/components/window`. The two
  stores differ in middleware and write style - read `.claude/rules/state.md` before editing either.
- **CSRF**: enforced in `src/proxy.ts` for every mutating request under `/api/*`, by comparing the
  `x-csrf-token` header against the `x-csrf-secret` httpOnly cookie. `ApiRequest` attaches the header
  automatically (`src/helpers/csrf.helper.ts` owns the token and retries once on a `403` carrying the
  CSRF marker, since the cookie expires after an hour). A check inside a form handler cannot enforce
  anything - the form pipeline runs client-side - so keep the gate in the middleware. Server actions
  bypass it by design and rely on Next's own origin verification. This is the mechanism; what it means
  at the form layer (nothing to do, per-form CSRF options are wrong) is in `.claude/rules/forms.md` §1.
- **Logging** - never call `console.*` directly; use `logger` / `logRejection` from
  `src/helpers/logger.helper.ts` (the only file allowed to touch `console`); signature is
  `(message, error?, context?)`, message first at every level. The third argument is shipped to
  Sentry, so it takes identifiers and shapes (`{ key }`, `{ uid }`, `{ payloadLength }`), never a
  payload, a record or a secret. Logger/Sentry wiring: `.claude/rules/observability.md`.
- **Never call a server action from inside a form pipeline** - applying its re-rendered tree
  resets `useActionState`, discarding the result. Server-side work goes in a route handler under
  `/api/`; post-sign-in redirects use `window.location.replace(...)`. A server action called
  *outside* a form pipeline is fine. Mechanism and evidence: `.claude/rules/forms.md` §8.
- **The dev server cannot validate auth changes.** Every bug in this area has been invisible
  locally: the server-action tree-reset only happens in the production React build, the redirect race
  resolves the *opposite* way when `/` is compiled on demand, and both `destroySession()` in
  `src/proxy.ts` and the backend's user-agent check on tokens are wrapped in
  `isEnvironment('production')`. A green local run is not evidence here - verify against a
  deployed build, and read state from the running page rather than inferring it.
- **Error boundaries**: `src/app/error.tsx` catches route errors, `src/app/global-error.tsx`
  catches failures in the root layout itself. The latter replaces that layout, so it gets no
  `globals.css` - it is inline-styled and dependency-free by design and must stay that way.
- **No `loading.tsx` above a route that can `notFound()`.** A `loading.tsx` is a Suspense
  boundary, and Next flushes the shell - status line included - the moment it reaches one. A
  `notFound()` that resolves after that still renders `not-found.tsx`, but the response is
  already committed as **200**, so a crawler is told the missing slug is a real page. This is
  why `(public)` has no `loading.tsx`: `/articles/:slug` and `/page/:label` both 404. Soft
  navigation still shows movement through `NavigationProgress`, mounted in the root layout.
  `(dashboard)/dashboard/loading.tsx` is fine - nothing under it calls `notFound()`. Verified
  by measuring the status both ways.
