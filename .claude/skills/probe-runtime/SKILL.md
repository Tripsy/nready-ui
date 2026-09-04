---
name: probe-runtime
description: Run a throwaway runtime probe against this project's real source to prove a behavioural claim. Use when a helper, regex, or pipeline needs verifying and there is no test suite — Node 24 type-stripping inside the container, plus the resolver-hook recipe for modules that import `@/*` for values.
---

# Runtime probes

There are no tests in this project, so a runtime probe is the only evidence for a behavioural
claim — and inspection routinely gets it wrong (a helper's own doc examples can be wrong, a
regex can be unreachable). This applies to your own fix as much as to the bug.

## Type-only imports — no hook needed

To spot-check a helper without a test suite, Node 24 runs TypeScript directly via type
stripping — `docker exec nready-ui.test sh -c "cd /var/www/html && node probe.ts"`, importing
the real module (`./src/helpers/x.helper.ts`). Type-only imports are erased, so a file whose
only `@/*` imports are `import type` resolves fine outside the path alias. This tests the
shipped source rather than a copy of it, which is the whole point — a hand-copied
reimplementation proves nothing about the code you are fixing.

## Value imports through the `@/*` alias — resolver hook

To probe a file that imports `@/*` for *values*, Node needs a resolver hook — it does not read
`tsconfig` paths. Write a hook module exporting `resolve(specifier, context, next)` that maps
`@/x` to `/var/www/html/src/x` (trying `.ts`/`.tsx`/`/index.ts`, since the alias leaves the
extension implicit), register it from a second file via `register('./hook.mjs', pathToFileURL('/var/www/html/'))`,
and run `node --import ./register.mjs probe.ts`. Prefer asserting through the module's public
surface (call the exported factory and exercise what it returns) over reaching for internals.

Probe files have to live **inside the repo**: `docker inspect nready-ui.test` shows one mount,
`/Users/Shared/Projects/nready-ui -> /var/www/html`, so nothing in a temp dir is visible to the
container. Name them `__probe-*.ts` / `__probe-*.mjs`, which `.gitignore` already covers, and
delete them when the question is answered.

## `--experimental-transform-types` when stripping is not enough

Strip-only mode erases types, it does not rewrite code, so it throws
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on anything that has to *emit* something — a constructor
parameter property (`constructor(private readonly parent: RoutesCollection)`, as in
`routes.setup.ts`) or a real `enum`. Add `--experimental-transform-types` and it compiles:

```
docker exec nready-ui.test node --experimental-transform-types \
	--import ./__probe-register.mjs /var/www/html/__probe-x.ts
```

Check how the module actually exports before importing it, too — `routes.setup.ts` ends in
`export default Routes`, so a named import fails at instantiation, not at type-check.

## Type probes — a targeted `tsc` while the dev server runs

A type-level claim ("removing this key breaks nothing", "this union rejects that pair") is proved
by the compiler, not by a runtime probe. A *full* `tsc` needs the dev server stopped, but a
targeted one runs happily alongside it: it writes nothing to `.next`, so it needs no
`pnpm run clean` either.

Write `tsconfig.probe.json` at the repo root (gitignored) that extends the real config and
replaces its inputs:

```json
{
	"extends": "./tsconfig.json",
	"compilerOptions": { "incremental": false, "plugins": [] },
	"include": [],
	"files": ["next-env.d.ts", "src/..."]
}
```

Then `docker exec nready-ui.test npx tsc -p /var/www/html/tsconfig.probe.json`.

- **Rewrite the `files` list every time.** It is the whole content of the probe and it is
  task-specific — a leftover list from a previous question type-checks the wrong subset and
  answers `exit 0` about code you did not touch. Treat a probe config found in the tree as
  stale, never as a starting point to trust.
- **Include `next-env.d.ts`**, or Next's ambient augmentation is missing and every `fetch` with
  `next: { revalidate }` reports a bogus `TS2353`.
- **Include the whole blast radius.** For a change to a shared type, that means every
  `src/**/*.definition.ts`, not just the file that failed — generate the list with a glob.
- **Assert the negative too.** A pair of lines proves the type actually bites:
  ```ts
  export const ok: ActionConfigPermission = ['cash-flow', 'refund'];
  // @ts-expect-error refund is gated on cash-flow only
  export const bad: ActionConfigPermission = ['user', 'refund'];
  ```
  If the constraint is too loose, `tsc` reports the directive as unused and the run fails — so
  `exit 0` proves both directions at once.

A green type-check is not a green runtime. `Object.hasOwn` vs `in`, a prototype key reaching a
lookup, an unreachable branch — none of that shows up here. Where the change has runtime
behavior, follow it with a probe from the sections above.
