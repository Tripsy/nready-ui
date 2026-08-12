---
paths:
  - "src/components/form/**"
  - "src/components/window/window-form.component.tsx"
  - "src/providers/window-form.provider.tsx"
  - "src/hooks/use-form-*.ts"
  - "src/helpers/form.helper.ts"
  - "src/helpers/form-process.helper.ts"
  - "src/helpers/validator.helper.ts"
  - "src/app/**/*.definition.ts"
  - "src/app/**/form-manage-*.component.tsx"
  - "src/app/**/*.action.ts"
---

# Forms Protocol

**Scope:** Client-side validation and the create/update form lifecycle for dashboard entities. Rules must
match the shape the backend actually accepts — see §3 below and `../star-api/.claude/rules/validation.md`.

## 1. Core Philosophy

- A dashboard entity's form is **declared, not hand-wired**: `<entity>.definition.ts` exports the Zod
  validator, `getFormValues`, `getFormState`, and the `create`/`update` `operationFunction`s. The generic
  `WindowForm` component (`src/components/window/window-form.component.tsx`) drives every entity through the
  same React 19 `useActionState` + `processForm` pipeline (`src/helpers/form-process.helper.ts`) — don't
  hand-roll a one-off submit handler for a new entity form.
- `useMutation` is not used for the primary entity submit (see `data-fetching.md` §1); it's fine for a
  secondary, inline action inside a form (e.g. quick-creating a related record).

### One pipeline, two hosts

Every form in the app submits through the same function — `processForm()`
(`src/helpers/form-process.helper.ts`): `getFormValues` → `validateForm` → `operationFunction` →
error mapping. What differs is only *who calls it* and what wraps the result.

| | `WindowForm` forms | Auth-entry forms |
|---|---|---|
| Examples | dashboard `<entity>`; authenticated account self-service (edit, email-update, password-update, delete) | login, register, password-recover(+change), email-confirm-send |
| Location | `(dashboard)/dashboard/<entity>/form-manage-<entity>.component.tsx`; account: `(public)/_components/account/` (window components + `account.definition.ts`) | `src/app/(public)/account/<flow>/` |
| Calls `processForm` from | The generic `WindowForm`, reading the options off the window definition | A thin per-flow `<flow>.action.ts` (e.g. `login.action.ts`) wired to `useActionState` |
| Reaches backend via | `operationFunction` in the definition → `requestCreate`/`requestUpdate` (or an `account.service.ts` fn) → `/api/proxy` | `operationFunction` → a `src/services/account.service.ts` function → `/api/proxy` |
| CSRF | Nothing to do — enforced for both by the middleware (see below) | Nothing to do — same gate |

Follow the `WindowForm` pattern (§2–§6 below) for anything under `dashboard/<entity>/` and for authenticated
account self-service windows (`_components/account/`). Follow the auth-entry pattern (§7) only when adding a
new **unauthenticated** login/register/recover/confirm flow.

**CSRF needs nothing at the form layer.** `src/proxy.ts` compares the `x-csrf-token` header against
the `x-csrf-secret` cookie on every mutating `/api/*` request, and `ApiRequest` attaches that header
automatically — so a form is covered whichever host it uses, including row actions, bulk delete and
image upload, which are not forms at all. Don't add a per-form CSRF option or a hidden token field:
a check inside `processForm` cannot enforce anything, because `processForm` runs in the browser.
The `Sec-Fetch-Site` / origin check in `isValidRequestSource()` still runs alongside it.

`src/helpers/form.helper.ts` deliberately holds only the pure, client-safe utilities
(`accumulateZodErrors`, `filterErrorsByTouched`, `createHandleChange`, `getFormDataAs*`).
The pipeline lives in its own module because it imports `session.helper.ts` — which is `'use server'` and
itself imports `form.helper.ts`. Adding that import to `form.helper.ts` would create a circular dependency
*and* drag server actions into every client component that only wanted `createHandleChange`.

## 2. Validator Class

```typescript
const validatorMessages = ['invalid_category', 'invalid_amount', /* ... */] as const;

class CashFlowValidator extends BaseValidator<typeof validatorMessages> {
	manage = z
		.object({
			category: this.validateEnum(CashFlowCategoryEnum, this.getMessage('invalid_category')),
			amount: this.validateNumber(this.getMessage('invalid_amount'), { required: true, onlyPositive: false, allowDecimals: 2 }),
			// ...
		})
		.superRefine((data, ctx) => {
			// cross-field rules: ctx.addIssue({ path: [...], message: ..., code: 'custom' })
		});
}
```

- Extend `BaseValidator<typeof validatorMessages>` (`src/helpers/validator.helper.ts`) and declare the
  `validatorMessages` tuple up top — it's what gives `getMessage()` its type-safe key union.
- Use the typed field helpers (`validateEnum`, `validateNumber`, `validateString`, `validateId`, ...) instead
  of raw `z.string()` / `z.number()` — they encode the project's required/optional and format conventions
  consistently.
- Cross-field rules go in `.superRefine()`, added via `ctx.addIssue({ path, message, code: 'custom' })`, not
  as a separate manual check after `safeParse`.
- Name the schema property after the form action it validates (`manage`, or `create`/`update` if they
  diverge), not a generic `schema`.

## 3. i18n and Backend Alignment

- Never hardcode a validation message string. Resolve every key in `validatorMessages` through
  `translateBatch(validatorMessages, '<entity>.validation')` inside an async `validateForm()`, then pass the
  translations into the validator's constructor.
- The namespace passed to `translateBatch` must **exactly match the key the locale file is registered under**
  in `src/locales/<lang>/index.ts` (e.g. `account-email-update.validation`, not `email-update.validation`).
  A mismatched namespace resolves to nothing and silently surfaces raw keys instead of messages.
- Before writing or changing a Zod schema here, check the authoritative shape in
  `../star-api/src/features/<entity>/<entity>.validator.ts` (field list, required/optional, formats,
  enum values) — client and backend validation must agree on what "valid" means. The backend's own
  `../star-api/.claude/rules/validation.md` documents its conventions (message-key resolution, partial
  update rules, etc.); mirror the *shape*, not the implementation (the backend uses `getMessage()`/i18next,
  this project uses `translateBatch()`).

## 4. Form Data Lifecycle

- `getFormValues(formData: FormData): FormValues` — parses native `FormData` into the typed values object
  using `getFormDataAsString` / `getFormDataAsNumber` / `getFormDataAsEnum` (`src/helpers/form.helper.ts`).
- `getFormState(entity?): FormStateType<FormValues>` — builds the initial state for **both** create (entity
  omitted, use field defaults) and update (entity provided, map its fields onto `values`). One function
  serves both actions; don't split into `getCreateState`/`getUpdateState`.
- `prepareParamsFromFormValues(data)` (per-entity, defined in `<entity>.definition.ts`) strips display-only
  fields and computes any derived params (e.g. net amount from gross + VAT) before the result is handed to
  `requestCreate` / `requestUpdate`.
- Display-only fields — values that exist purely to render UI feedback (a selected client's label, etc.) and
  are never sent to the backend — must be marked with a `// display-only fields, not part of validation`
  comment in the `FormValuesType`, excluded from the Zod schema, and stripped in `prepareParamsFromFormValues`.

## 5. Live Validation

`useFormValidation` (`src/hooks/use-form-validation.hook.ts`) debounces re-validation (800ms default) and
only surfaces errors for fields the user has touched, via `filterErrorsByTouched` — until the form is
submitted, at which point all errors from `accumulateZodErrors` show. Don't bypass this by validating
unconditionally on every keystroke or skipping the touched-field filter; it's what keeps a fresh "create"
form from showing every required-field error before the user has typed anything.

## 6. Field Rendering

- Use the shared components in `src/components/form/form-element.component.tsx` rather than raw
  `<input>`/HeroUI elements — they wire up error display and element ids consistently. The full
  set is `FormComponent` + `Input` / `Select` / `Radio` / `Checkbox` / `Textarea` / `Time` /
  `Calendar` / `AutoComplete` / `Submit`, plus the pre-configured `Name` / `Email` / `Password`
  wrappers. Check the file before hand-rolling a field — a checkbox and a date picker already exist.
- Inside a form, read and write field state through `useWindowForm()` (`window-form.provider.tsx`), which
  exposes `{ formValues, errors, handleChange, pending }` — don't keep a form field's value in local
  `useState` instead (a search box feeding an autocomplete is fine in local state; the field it ultimately
  sets is not).
- `handleChange` supports dotted/nested paths (e.g. `handleChange('operational_records', {...})` for a
  nested object) — use this instead of manually merging nested state.

## 7. Auth-entry Forms (the other host)

The **unauthenticated** auth-entry flows — login, register, password-recover (+ `[token]` change),
email-confirm-send — each have their own `<flow>.action.ts` + `<flow>.definition.ts` + `<flow>.component.tsx`
and are routed pages, not windows, because each renders its own success/failure screen (`SuccessComponent`,
login's `AuthTokenList` + post-login redirect). For this pattern only:

- The component wires `useActionState` directly to the exported action function (e.g.
  `useActionState(loginAction, initState)`); that action is a thin wrapper that returns `processForm(...)`.
- These action files run **client-side on purpose** — they carry no `'use server'`, which is what keeps
  them inside the middleware's CSRF gate. Don't add one.
- Per-flow backend failures go in `mapApiError(error)`, which maps an `ApiError` status onto
  `{ message?, situation?, resultData? }`; anything it leaves out falls back to `fallbackErrorKey`
  (default `app.error.form`) and `serverError`. Don't hand-roll a `try`/`catch` around the request.
- A flow that needs an outcome beyond `FormSituationType` (login's `maxActiveSession`, register's
  `pendingAccount`) widens its own `<Flow>SituationType`; `processForm` picks it up via `State['situation']`.
  `csrfError` is already part of `FormSituationType` — `processForm` maps the middleware's 403 onto it —
  so don't re-add it per flow.
- Multi-step submits belong in the `operationFunction`, not around it: `login.action.ts` chains
  `requestLogin` → `createAuth` there so the form only reports success once the session cookie exists.
- Everything else (validator class, `getFormValues`, debounced `useFormValidation`, shared field components)
  follows the same conventions as §2–§6.

**`oauth-callback.action.ts` is not one of these**, despite the `.action.ts` name and living next to a
`.definition.ts`. There is no form — no fields, no `FormData`, no `processForm`, no validator — only a
provider redirect to redeem. It is therefore the one action file that *does* carry `'use server'` (the
`state` cookie must be read and cleared server-side; there is no browser form for the CSRF header to
ride on), and its `.definition.ts` holds only the state shape and translation keys.
`OAuthCallbackSituationType` is its own standalone union (`pending` / `success` / `error` /
`maxActiveSession`) — it deliberately does **not** extend `FormSituationType`, because most of that
type describes form outcomes this flow cannot have. The overlap with login (`maxActiveSession`
rendering the same `AuthTokenList`) is a shared failure, not a shared pipeline.
See CLAUDE.md's "Social login (OAuth)" for the full flow.

### Authenticated account self-service uses `WindowForm`, not this pattern

Account edit / email-update / password-update / delete are **windows** opened from `/account/me`, driven by
`src/app/(public)/_components/account/account.definition.ts` (one `account` virtual data source, actions
`edit` / `emailUpdate` / `passwordUpdate` / `deleteAccount`). They follow §2–§6 like any dashboard entity.
Notes specific to them:

- They reuse the validators + `FormValuesType` still living in `(public)/account/<flow>/<flow>.definition.ts`;
  those files now hold **only** the validator and the form-values contract — the old `page.tsx` /
  `<flow>.component.tsx` / `<flow>.action.ts` and the per-flow state types are gone.
- `getFormValues` must be **synchronous** (`processForm` calls it without `await`), which is why
  `account.definition.ts` owns the `edit` flow's version rather than the definition file.
- No permission gating: the actions omit `permission` (optional on the config), and `account` is registered in
  `PermissionEntitiesSuggestions` only as a virtual key (`// NOT an entity`, like `dashboard`) so it satisfies
  `DataSourceKey ⊆ PermissionEntityType`.
- Post-submit side effects (refreshAuth, redirect after delete) go through the window's `events.success`.
