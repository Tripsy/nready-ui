---
paths:
  - "src/stores/**"
  - "src/app/**/_providers/data-table.provider.tsx"
  - "src/components/window/**"
---

# Client State Protocol

**Scope:** Zustand store conventions, and what belongs in a store vs. local component state vs. server cache.

## 1. Core Philosophy

Zustand owns **transient client/UI state** only:

- Data-table state: pagination, sort, filters, row selection.
- The modal/window stack: which windows are open, minimized, focused.

It does **not** own:

- Server data (list results, entities) — that's TanStack Query's job, cached by query key. See
  `data-fetching.md`.
- Form field values while a form is open — that's React 19 `useActionState`, owned by `WindowForm` /
  `useFormValues`. See `forms.md`.

If you're about to add a field to a Zustand store, first check it isn't actually server data or form state
that belongs in one of those two places instead.

## 2. Two Store Shapes — Pick Deliberately

**Singleton, app-wide** — `src/stores/window.store.ts` (`useModalStore`): a single `create<WindowStore>()`
for the whole app, holding the open window/modal stack (`open`, `close`, `closeAll`, `minimize`, `focus`,
`getWindow`, `getCurrentWindow`). Use this shape for state that is inherently global — there is only one
modal stack in the app, so it doesn't need per-instance isolation.

**Per-instance, scoped via Context** — `src/stores/data-table.store.ts` (`createDataTableStore(section,
dataSource, initialState)`): a *factory* that returns a fresh store, instantiated once per data-table inside
`src/app/(dashboard)/_providers/data-table.provider.tsx` and handed down through React Context
(`DataTableContext`). Every entity's list view (`user`, `brand`, `cash-flow`, ...) — and, if the same entity's
table is ever rendered twice on one page — gets its own isolated store instance instead of colliding in one
shared slot.

When adding a new kind of "many independent instances of the same widget" state, follow the data-table
factory-plus-Context shape, not a single global `create()`.

## 3. Slice Pattern

This applies to the data-table store; the window store is a single flat definition and doesn't need it.

Split a store's state into composable slice factories instead of one flat state object:

```typescript
export const createDataTableSlice = (initialState: DataTableStateType):
	StateCreator<DataTableStore, [['zustand/immer', never]], [], DataTableSlice> =>
	(set) => ({
		tableState: structuredClone(initialState),
		updateTableState: (newState) => set((state: Draft<DataTableSlice>) => { /* ... */ }),
	});
```

Combine slices inside the final `create()` call by spreading each factory's output. Add a new concern (e.g.
a new piece of per-table UI state) as a new slice, not by bloating `DataTableSlice` or
`DataTableSelectionSlice` directly.

## 4. Middleware Stack

The two stores do **not** share a middleware stack — check which one you are in before writing an update:

| | `data-table.store.ts` | `window.store.ts` |
|---|---|---|
| Middleware | `devtools` + `persist` + `immer` | `devtools` + `persist` — **no immer** |
| Write style | mutate `state.x = y` inside `set((state: Draft<...>) => { ... })` | return a new object: `set((state) => ({ stack: state.stack.map(...) }))` |

Writing an immer-style mutation in the window store fails silently — no error, no type complaint, the
update simply never lands. Match the store you are editing.

**devtools** — store name is passed for Redux DevTools visibility.

**persist**, data-table stores — `localStorage` under `datatable-store-<section>-<dataSource>`, via a
`partialize` that **only** persists `tableState` and `selectedEntries` (not `isLoading`). If you add a new
top-level field, decide explicitly whether it belongs in `partialize` — don't assume store state is
persisted. The store is versioned (`version: 1`); bump it when you change the shape of
`DataTableStateType` or the filters, so stale persisted state is dropped rather than rehydrated into code
that can no longer read it.

**persist**, window store — different in ways that matter:

- `partialize` keeps only the serializable shell of each window (`uid`, `section`, `dataSource`, `action`,
  `minimized`, `data`, `props`). `definition` and `events` are deliberately dropped — they hold functions.
  A restored window is therefore incomplete until its definition is re-attached.
- `skipHydration: true`, because definitions are lazy-loaded and restoring the stack is async, so it cannot
  happen during the SSR-matched first render. `hydrateWindowStore()` performs it explicitly with a real
  `setState`; there is no `onRehydrateStorage` callback, since zustand does not await it.
- `clearWindowStore()` is the logout path: it awaits hydration first (so an in-flight restore cannot
  repopulate the stack behind it), then `closeAll()` — which also clears form drafts — then
  `persist.clearStorage()`. If you add anything persisted and user-specific, clear it here too.

## 5. Access Pattern

Read via `useStore(store, selector)` (`zustand/react`) with a narrow selector per piece of state:

```typescript
const tableState = useStore(dataTableStore, (s) => s.tableState);
const selectedEntries = useStore(dataTableStore, (s) => s.selectedEntries);
```

Don't destructure the whole store (`const { tableState, selectedEntries } = useStore(dataTableStore)`) — a
narrow selector per value is what lets Zustand skip re-renders for components that only care about one slice.

## 6. Local Component State

Anything not shared beyond a single component — a search box's in-progress text before it's fed into a
query, a toggle, "is this dropdown open" — stays in plain `useState`. Don't promote it to a Zustand store
just because one already exists nearby for the surrounding feature; see the `searchClient` /
`searchEmployee` / `searchVendor` local-state pattern in `form-manage-cash-flow.component.tsx`, each feeding
its own `useRemoteAutocomplete` call.
