---
paths:
  - "src/services/**"
  - "src/helpers/api.helper.ts"
  - "src/helpers/services.helper.ts"
  - "src/hooks/use-remote-autocomplete.ts"
  - "src/hooks/use-local-autocomplete.ts"
  - "src/hooks/use-refresh-data-table.hook.ts"
  - "src/providers/query-client.provider.tsx"
  - "src/app/**/data-table-*.component.tsx"
---

# Data Fetching Protocol

**Scope:** Reading backend data, cache keys, invalidation. For submitting create/update forms, see `forms.md`.

## 1. Core Philosophy

- **TanStack Query is for reads.** Data tables, single-entity lookups, autocompletes, and any other GET all go
  through `useQuery`. The primary create/update/delete flow for an entity does **not** go through
  `useMutation` — it goes through React 19 `useActionState` + the shared `WindowForm` component (see
  `forms.md`). Reserve `useMutation` for secondary, inline actions that aren't the form's main entity (e.g.
  the "quick-create a vendor" mutation inside `form-manage-cash-flow.component.tsx`).
- **Never call the backend directly from a client component.** All backend access goes through
  `src/helpers/api.helper.ts`'s `ApiRequest` (directly, or wrapped by a `src/services/*.service.ts` /
  `src/helpers/services.helper.ts` function). This is what attaches the session cookie via
  `/api/proxy/[...path]/route.ts` and builds the URL from `REMOTE_API_URL`.

## 2. Service Layer

- Generic CRUD: `src/helpers/services.helper.ts` exports `requestView`, `requestFind`, `requestCreate`,
  `requestUpdate`, `requestDelete`, `requestDeleteMultiple`, `requestRestore`, `requestUpdateStatus` — all
  keyed by a `DataSourceKey` and resolved to a path via `resolveRequestPath()`. Use these for any entity that
  follows the standard dashboard CRUD shape rather than writing a bespoke fetch.
- Entity-specific one-offs (auth flows, stats, image upload/delete, non-CRUD actions) live in
  `src/services/<entity>.service.ts` as plain async functions returning `ApiResponseFetch<T>`. Add a new
  wrapper next to its siblings in the matching file.
- Unwrap responses with `getResponseData(response)` (`api.helper.ts`) rather than reaching into
  `response.data` inline.
- Before wrapping a new backend endpoint, check `../star-api/src/features/<entity>/<entity>.routes.ts`
  and `<entity>.controller.ts` for the exact path, method, and response envelope — don't guess the shape from
  the frontend side.

## 3. Query Key Conventions

Reuse these existing key shapes instead of inventing new ones:

| Use case | Key shape | Example |
|---|---|---|
| Data table list | `['dataTable', dataSource, first, rows, sortField, sortOrder, filters]` | `data-table-list.component.tsx` |
| Single entity loaded into a window/modal | `[WINDOW_CACHE_LABEL, uid, entryId]` (`WINDOW_CACHE_LABEL` from `helpers/window.helper.ts`) | `window-instance.component.tsx` |
| Related/nested lookup for an open entity | `['<entity>', '<sub-resource>', id]` | `['cash-flow', 'operational-records', entryId]` |
| Remote autocomplete search | `['s-<entity>', ...]` prefix, fed to `useRemoteAutocomplete` | `['s-client']`, `['s-vendor']` |

## 4. Standard List-View Query

```typescript
const { data, isLoading } = useQuery({
	queryKey,
	queryFn: async () => {
		const response = await dataTable?.find({ ...pagination, filter });
		if (!response) throw new Error(`Could not retrieve ${dataSource} data`);
		return response;
	},
	placeholderData: keepPreviousData,
});
```

- Always set `placeholderData: keepPreviousData` on paginated/filtered list queries so the table doesn't blank
  out between pages.
- Gate dependent queries with `enabled` (e.g. `enabled: !!entryId`) rather than branching inside `queryFn`.
- Defaults come from `QueryProvider` (`src/providers/query-client.provider.tsx`): `staleTime` 5 min, `gcTime`
  10 min, `retry: 1`, `refetchOnWindowFocus: false`. Override per-query only when there's a specific reason
  (document it inline if you do).

## 5. Cache Invalidation

- On a successful form submit, `useWindowFormProcessed` (`src/hooks/use-form-processed.hook.ts`) already:
  - invalidates `[WINDOW_CACHE_LABEL, uid, entryId]` when the window definition has `reloadEntry` set (update
    actions only), and
  - dispatches `dispatchFilterReset(dataSourceKey)` to force the dashboard's data table to refetch.
  Don't manually `invalidateQueries(['dataTable', ...])` inside a form component — it's already handled.
- For actions outside the form flow (bulk delete, restore, status change from a row action), call
  `useRefreshDataTable()` (`src/hooks/use-refresh-data-table.hook.ts`) explicitly, which invalidates
  `['dataTable', dataSourceKey]`.

## 6. Errors

- `ApiRequest` throws `ApiError` (status + parsed payload) on a non-2xx response — don't swallow it with a
  bare try/catch; let it surface to the form's `situation` state (see `forms.md`) or the caller's own error
  handling, and report failures through `useToast`, not `console.error`.
- Auth-adjacent fetches follow a fail-open convention for server errors: in `src/proxy.ts`,
  `fetchAuthModel()` treats a `>=500` `ApiError` as "server may be down, don't punish the user's session"
  (returns `false`, not `null`), while 401/403/invalid-token responses invalidate the session (`null`).
  Preserve this distinction if you touch auth-related fetches — a backend outage should not log users out.
