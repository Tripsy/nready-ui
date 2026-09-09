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
| `forms.md` | Validators, `<entity>.definition.ts`, the `processForm` pipeline, both form hosts | form/definition/action files, form helpers |
| `data-fetching.md` | TanStack Query, service layer, query keys, cache invalidation | `src/services/**`, api helpers, data-table components |
| `state.md` | Zustand stores, what belongs in a store vs. local state vs. server cache | `src/stores/**`, `src/components/window/**` |
| `comment.md` | The public comment/rating/report widgets: translations across the server boundary, per-visitor reads, comment anchors | `src/components/{comment,complaint,rating}/**` |
| `typescript.md` | TS/React conventions, linting rules, type-checking | every `.ts`/`.tsx` |
| `oauth.md` | The two-leg social-login flow, the `state`/`oauth-state` CSRF contract, adding a provider | `src/app/api/oauth/**`, `src/app/(public)/account/oauth/**`, `oauth.type.ts` |
| `observability.md` | `logger` internals, the Sentry init/mapping layer, the tunnel route | `sentry.setup.ts`, `sentry.*.config.ts`, `instrumentation*.ts`, `logger.helper.ts` |
| `locales.md` | Translation files, the shared vs. entity-specific validation-message split | `src/locales/**`, `validator.helper.ts` |
| `images.md` | The upload/list/delete services and the `local`/`s3` storage backends | `src/services/image*.ts`, `manager-images.component.tsx` |
| `money.md` | The scaled-integer amount format the backend stores, and `roundAmount()` | `cash-flow.service.ts`, `string.helper.ts` |
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

## Coding Standards

- Follow existing code conventions used in the project. When creating or editing a file, check sibling files for the correct structure, approach, and naming.

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

**pnpm 11 no longer reads the `pnpm` field in `package.json`** - settings live in
`pnpm-workspace.yaml`. A dependency whose install scripts are blocked reports
`ERR_PNPM_IGNORED_BUILDS` and pnpm writes a placeholder into `allowBuilds` there for you to
resolve; setting it in `package.json` is silently ignored with a warning. This matters for
anything whose postinstall fetches a binary (`@sentry/cli` downloads the uploader that
`next build` uses for source maps), because the build still succeeds without it and only the
downstream artefact is missing.

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

This container is capped at **6g** (`mem_limit` in `docker-compose.yml`; the API's is 4g) and
Turbopack fills a large part of it - around 3.2g is its *resting* level with the dev server up,
not a leak. The Turbopack arena is capped separately at 2g (`turbopackMemoryLimit` in
`next.config.ts`); those two numbers are the lever, not the cache.

If the dev server exits with nothing in the log it was SIGKILLed, not crashed - check
`docker inspect nready-ui.test --format '{{.State.OOMKilled}}'`, then `pnpm run clean` and
restart. **`OOMKilled` can read `false` on an exit 137**: the process is killed from outside the
container (host memory pressure, Docker Desktop reclaiming) rather than by the cgroup limit, and
the symptom is the same - an API or UI that answers 404/500 to everything until it is restarted.
`/dev-stack status` reports both the exit code and that flag.

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
- `src/app/api/proxy/[...path]/route.ts` forwards dashboard requests to the backend, attaching the session
  cookie as a `Bearer` token.
- `src/proxy.ts` (the Next.js middleware) resolves auth/permission on every route by
  calling the backend's `/account/me` with the session token, then attaches the result as `x-auth-data`.
- `src/models/permission.model.ts` (`PermissionEntityType` / `PermissionOperationType`) mirrors the
  backend's permission entities - keep the two in sync when the backend adds/renames an entity.

## Restrictions

- This project has no tests at the moment.
- Do not run biome after applying change. Run it only on demand or before git push commands.
- Stop the dev server before running `build` or a full `tsc` - the container cannot hold both (see
  Commands). A targeted `tsc` over an explicit `files` list is fine alongside it.  
- **Never commit onto `main`.** GitHub refuses a direct push to it, so a commit made there has to be
  moved off before it can go anywhere. If the current branch is `main` when a commit is requested,
  create the branch first (`git switch -c <type>/<short-name>`) and commit on that. The same applies
  in `../nready-api`.
- When subagents are available and appropriate for the task, prefer delegating noisy operations
  (broad searches, log trawls, build output) to one - this is a preference for keeping the main
  context clean, not an instruction to spawn agents unprompted.

## Architecture

- **Dates and timezones** (`src/helpers/date.helper.ts`) - three deliberate conventions, don't
  "unify" them:
  1. *Typed times* mean the **user's device clock**. `combineDateAndTime` uses `setHours`,
     which resolves in the runtime zone, and these run client-side; serialising the Date gives
     the backend the right UTC instant.
  2. *Filter day-boundaries* mean **company time** - `toUTCISOString` reads its input as
     `app.timezone` so two managers in different countries filtering the same day get the same
     rows. This is the only place company time applies.
  3. *Display* is always the user's device zone, which happens for free: table and stats data
     is fetched client-side, so no timestamp is ever server-rendered (verified - the SSR HTML
     for `/dashboard` and `/dashboard/user` contains no formatted dates). Keep it that way; a
     date formatted in a server component would render in the container's UTC.
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
- **Creating a related record from inside a form**: a form that picks a foreign entity also offers
  to create it, by opening that entity's own window rather than collecting a name inline - that
  window is what makes the new row complete (slug, per-language content, the fields the picker has
  nowhere to ask for). The pattern is three parts, and it is broken if any one is missing:
  1. capture `getCurrentWindow()` *before* `open()`, and `focus(parentWindow.uid)` in the `success`
     event - `open` minimizes the caller, so without it the editor lands on an empty desktop with a
     half-filled form parked in the dock;
  2. seed the child through `data.prefillEntry`, passing the caller's own context so the child can
     ask what the caller cannot decide (`form-manage-product`/`form-bundle-product` hand
     `product-category-attribute` a `category_id` when there is exactly one category and always a
     `category_options` list for when there are several);
  3. refresh whatever the new row feeds - `refetchResolved()` for attributes, an
     `invalidateQueries` on the picker's suggestion key for a brand, whose cache still holds the
     empty result that prompted the create.
  Gate the button on the permission the *backend* policy checks, not the one the current form needs:
  a product-category-attribute is written under `product`/`create`. Offering a create the account
  cannot perform only defers the refusal to the submit.
- **Data tables**: list views use a shared `data-table` abstraction backed by `src/stores/data-table.store.ts`
  (Zustand); windows/dialogs are backed by `src/stores/window.store.ts` and `src/components/window`. The two
  stores differ in middleware and write style - read `.claude/rules/state.md` before editing either.
- **Config layer** (`src/config`): `settings.config.ts` (`Configuration.get(...)` - env-driven app settings,
  typed by dotted path so a typo is a compile error), `routes.setup.ts` (route table + auth),
  `data-source.config.ts` (maps `DataSourceKey` values to backend list/filter endpoints for data tables),
  `translate.setup.ts` (i18n), `init-redis.config.ts`.
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
- **Never call a server action from inside a form pipeline.** A server action is POSTed to the
  *current* URL and its response carries a re-rendered tree for that page. Applying that tree
  **resets the submitting form's state**: `useActionState` reverts to its initial value, so the
  result the action just returned is discarded, and the field values derived from it go with it.
  The scope is narrow, and worth knowing before ripping out unrelated actions: a server action
  called *outside* a form pipeline is fine. Measured on production - the `refreshAuth` interval
  in `auth.provider.tsx` fires `getAuth` every 10 minutes app-wide, and after one such call the
  React-rendered nodes were still attached and untouched, so the tree reconciles rather than
  remounts and ordinary `useState` survives. It is the nesting inside `useActionState` that
  destroys the result. A form that calls an action from its `operationFunction` therefore
  completes its work server-side and then comes back pristine - no message, no result, nothing
  to act on, and only a reload reveals that anything happened. Whatever the pipeline needs
  server-side goes in a **route handler under `/api/`** instead, which answers with plain JSON
  and no tree; `POST /api/auth/session` (`requestCreateSession`) exists for exactly this, and
  being a mutating `/api/` request it also passes the CSRF gate an action bypasses.
  The weaker form of the same problem hits navigation: applying that tree makes the action's URL
  canonical again, so a `router.push`/`replace` racing it is undone. `await`ing the action does
  not fix it - the promise resolves on the return value while the tree patch is a separate
  commit. Post-sign-in redirects therefore leave the page with `window.location.replace(...)`,
  which cannot be reverted, and the destination is server-rendered with the session cookie so
  `providers.tsx` seeds `AuthProvider` from `x-auth-data` with no `refreshAuth` needed
  (`login.component.tsx`, `oauth-callback.component.tsx`).
- **The dev server cannot validate auth changes.** Every bug in this area has been invisible
  locally: the tree-reset above only happens in the production React build, the redirect race
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
