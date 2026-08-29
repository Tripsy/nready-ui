---
description: Scaffold a new /dashboard CRUD entity end-to-end, mirroring an existing backend feature
argument-hint: "<entity> (singular, kebab-case — e.g. carrier, warehouse, order-shipping)"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, Agent
---

Add the dashboard CRUD feature for **$ARGUMENTS**.

The backend (`../nready-api/src/features/<entity>/`) is the contract. Read it first, then build
the frontend to match — never invent fields, filters or endpoints.

## 1. Read the backend before writing anything

| File | What to extract |
|---|---|
| `<entity>.entity.ts` | column names, nullability, enums → the FE model type |
| `<entity>.validator.ts` | `create` / `update` schemas → the FE `manage()` schema; `OrderByEnum` → which columns may be `sortable`; `find.filterSchema` → the **only** filters the data table may send |
| `<entity>.routes.ts` | which operations exist (`create/read/update/delete/restore/find`, status/extra routes) → which `actions` to declare; the **`basePath`** → whether the endpoint is plural |
| `<entity>.repository.ts` | `filterByTerm` → what the global search actually matches, for the search label |
| `<entity>.service.ts` | conflict rules (e.g. unique name → 409) and any create-only fields |
| `<entity>/locales/en.json` | message keys; `docker exec nready-api.test sh -c "cd /var/www/html && pnpm run messages:check"` proves every `lang()` key and every `validatorMessages` entry resolves — run it if you touched the backend locale, and treat a finding as a real backend bug rather than papering over it |

Nothing in `find.filterSchema` means nothing to filter on: a filter the backend does not accept
is dropped, so the table silently ignores it.

## 2. Pick the closest existing entity as the template

Copy structure, not guesses:

- **has `status` + soft delete** (enable/disable/delete/restore) → `dashboard/vendor`
- **no `status`, soft delete** → `dashboard/carrier`
- **no `status`, no restore** → `dashboard/document-series`
- **content translations / parent-child** → `dashboard/brand`, `dashboard/place`, `dashboard/category`

Before proposing an approach, read the path-scoped protocols that apply:
`.claude/rules/forms.md` (definition + `processForm` pipeline), `.claude/rules/data-fetching.md`
(services, query keys), `.claude/rules/state.md` (the two stores), `.claude/rules/typescript.md`.

## 3. Files to create

`src/models/<entity>.model.ts` — `<Entity>Model<D = Date | string>` plus any enum and a
`display<Entity>Label(entry)` used for window titles.

`src/app/(dashboard)/dashboard/<entity>/`:

| File | Notes |
|---|---|
| `<entity>.definition.ts` | the whole feature: validator, `getFormValues` / `getFormState`, `<Entity>DataTableFiltersType`, table columns, `actions`. Default-exports `async function dataSourceConfig()` — `data-source.config.ts` imports it **by path convention**, so the filename must match the key exactly |
| `data-table-<entity>.component.tsx` | `DataTableProvider` + filters + actions + list |
| `data-table-filters-<entity>.component.tsx` | one control per backend filter; `global` is renamed to `term` by `data-table-list.component.tsx` |
| `form-manage-<entity>.component.tsx` | exports `<Entity>FormValuesType`; fields via `FormComponent*`, ids via `useElementIds` |
| `view-<entity>.component.tsx` | `'use client'`, `ViewSection` / `ViewField`, timestamps section last |
| `usage-guide-<entity>.component.tsx` | a thin wrapper over the shared `UsageGuide` — see below |
| `page.tsx` | `generateMetadata` from `<entity>.meta.title` + `BreadcrumbSetter` + the data table |

### The usage guide window

`src/app/(dashboard)/_components/usage-guide.component.tsx` renders the whole thing; the
per-entity file only binds props, and is expected to stay under twenty lines:

```tsx
// usage-guide-discount.component.tsx
'use client';

import { UsageGuide } from '@/app/(dashboard)/_components/usage-guide.component';

const DOCS_TABS = [{ id: 'api', labelKey: 'tab_api', feature: 'discount' }] as const;

export function UsageGuideDiscount() {
	return <UsageGuide entity="discount" stepCount={5} docsTabs={[...DOCS_TABS]} />;
}
```

- `entity` is the locale namespace (`<entity>.help.*`), and `stepCount` must equal the number of
  `step_N_title`/`step_N_body` pairs there — a mismatch renders blank steps rather than failing.
- `feature` is the **backend route module**, which is not always the entity: a feature folder can
  hold more than one, and `article` ships `article` alongside `article-public`. A reader-facing
  entity therefore gets a second tab (`{ id: 'public', labelKey: 'tab_public', feature:
  '<entity>-public' }`) and a `tab_public` label.
- Each tab fetches only once its own tab is opened, so extra tabs cost nothing until used.
- The API tab needs `../nready-api/src/features/<entity>/<entity>.docs.ts` to exist
  (`/implement-feature` writes it). Without it `GET /docs/<entity>` is a 404 and the tab shows an
  error while the Info tab still works — so either write the backend docs in the same pass or leave
  `docsTabs` empty until you do.

The action itself, declared in `<entity>.definition.ts` alongside the CRUD ones:

```typescript
guide: {
	windowType: 'other',
	windowTitle: translations['guide.title'],
	windowComponent: UsageGuideDiscount,
	windowConfigProps: { size: 'xl2', closeOnBackdrop: true, closeOnEscape: true },
	permission: ['discount', 'read'],
	entriesSelection: 'free',
	buttonPosition: 'right',
	button: { variant: 'outline', hover: 'info', icon: Icons.Info },
},
```

`'other'` + `'free'` is the entry-less window combination — every other `other` action selects a row
first. Add `'guide.title'` to the `translateBatch` list.

**Write the Info steps from what the code enforces, not from the field labels.** The form already
shows what the fields are called; the guide earns its place by carrying what it cannot — a value
that is required only in combination with another, an action that appears only for one role, a
status with no route back, a delete that keeps a unique column occupied. Read the validator's
`superRefine` blocks and the definition's `customEntryCheck`s, and say what they do.

## 4. Registrations — all of them, or the feature half-works

1. `src/types/data-source.key.ts` — import the model, add `<entity>: <Entity>Model` to `DatasourceModels`.
2. `src/helpers/api.helper.ts` — **if the backend `basePath` is not the key itself**: add the key to
   `PLURAL_ENDPOINT_KEYS` (`carrier` → `/carriers`), or to `IRREGULAR_ENDPOINT_KEYS` for anything
   the `+ 's'` rule cannot express (`category` → `categories`). Skipping this is the classic
   silent 404 — every request goes to the singular path and the table just comes back empty.
3. `src/locales/en/<entity>.json` **and** `src/locales/ro/<entity>.json` — file name is
   **singular**, keys: `meta.title`, `validation.invalid_*`, `action.<op>.{title,label,success,confirm}`,
   plus `status.*` only if the entity has a status. Register both in `src/locales/<lang>/index.ts`
   (import + map entry; quote the key when it is kebab-case).
   The guide adds `action.guide.{title,label}` and a `help` block: `intro`, `note`, `tab_info`,
   `tab_api` (plus `tab_public` when there is a public module), and a `step_N_title`/`step_N_body`
   pair per step. Both languages, or the missing one renders raw keys.
4. `src/locales/{en,ro}/dashboard.json` — `labels.<entity>` (the side-menu / breadcrumb label, plural wording).
5. `src/models/permission.model.ts` — add the entity to `PermissionEntitiesSuggestions` if absent.
6. `src/models/log-history.model.ts` — add the **backend table name** (snake_case) to `LogHistoryEntities`.
7. `src/components/icon.component.tsx` — a lucide import (alphabetical) + an `Icons.<Entity>` entry.
8. `src/app/(dashboard)/_components/side-menu.component.tsx` — add `dashboard.labels.<entity>` to
   `translationsKeys` **and** the item to a section, gated by `hasPermission(auth, '<entity>')`.
   **Placement is the user's call, not yours.** Existing sections are `financial`, `content`,
   `settings`, `logs`, `user-management`. Propose one — or a new section, with its own label,
   icon and `dashboard.labels.<section>` entry in both locale files — say why, and **wait for
   confirmation before editing the file**. Everything else in this list you decide yourself;
   this one lands in front of the user on every page, so a wrong guess is theirs to live with.
   Build the rest of the feature while the question is open rather than blocking on it.
9. `src/config/routes.setup.ts` — `.add('<entity>', '/dashboard/<entity>', { permissionEntity: '<entity>' })`
   inside `Routes.group('dashboard')`. Extra sub-pages (order/tree) get their own entry with
   `permissionOperation`.

Validation messages that are generic (`only_positive`, `name_min`, …) come from
`sharedValidatorMessages` — spread them and use `resolveValidatorMessages()` instead of a bare
`translateBatch`, otherwise the shared keys resolve to raw key strings.

## 5. Verify

- `docker exec nready-ui.test sh -c "cd /var/www/html && npx tsc --noEmit"` — **stop the dev server
  first** (`/dev-stack stop ui`); the container cannot hold both.
- Then `/dev-stack start ui` and exercise the real page at `http://nready-ui.test/dashboard/<entity>`
  — **not** `localhost`, which is not in `ALLOWED_ORIGINS` so sign-in fails there:
  list loads, create, update, view, delete, restore, search, show-deleted, and the usage guide —
  every tab, since each one only fetches when opened and an unregistered docs module fails there
  and nowhere else. Reading the code is not evidence — this project has no tests, so the running
  page is the only proof.
- Admin bypasses permission checks (`hasPermission` short-circuits on role `admin`), so a green
  admin run says nothing about the `system.permission` rows a member/operator would need.
- `docker exec nready-ui.test sh -c "cd /var/www/html && pnpm run biome"` — run it, do not just
  suggest it. This is the "on demand" case CLAUDE.md's don't-run-biome rule leaves open: a new
  entity is a dozen fresh files and the import-order, formatting and circular-dependency checks
  are exactly what a copied folder gets wrong. It writes fixes in place, so re-read anything you
  still have open, and report what it changed.

Report at the end: files created, registrations touched, what was exercised in the browser, and
any backend mismatch found in step 1.
