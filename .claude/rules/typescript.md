---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "*.ts"
---

# TypeScript & React Conventions

**Scope:** Language-level conventions, type design, and lint rules — the baseline for every
`.ts`/`.tsx` file, plus root-level configs like `next.config.ts`. For the conventions of a specific
subsystem, see the narrower sibling rules (`forms.md`, `data-fetching.md`, `state.md`), which layer
on top of this one.

# JavaScript Best Practices

- Use `const` for all variables that aren't reassigned, `let` otherwise
- Don't use `await` in return statements (return the Promise directly)
- Always use curly braces for control structures, even for single-line blocks
- Prefer object spread (e.g. `{ ...args }`) over `Object.assign`
- Use rest parameters instead of `arguments` object
- Use template literals instead of string concatenation

## Code Organization

- Document complex types with JSDoc comments
- Shared types live in `src/types/*.type.ts`; backend entity shapes live in `src/models/*.model.ts`.
  A type used by one component belongs next to it, not in `src/types`.
- Shared helpers live in `src/helpers/*.helper.ts`. Import them directly — there is no barrel file, and
  adding one risks the import cycles `noImportCycles` exists to catch.
- Path alias `@/*` maps to `src/*`. Use it rather than long relative chains.

## TypeScript Configuration

- `strict: true` (so `noImplicitAny` and `strictNullChecks` are on), `module`/`moduleResolution` are
  `ESNext`/`bundler`, `jsx: react-jsx`, `target: ESNext` — modern syntax needs no downlevel workaround, and
  Unicode property escapes (`\p{...}`) are available.
- Type-check with `docker exec star-ui.test sh -c "cd /var/www/html && npx tsc --noEmit"`. Nothing here
  emits JS through `tsc` — Next/Turbopack owns the build — so `tsc` is a checker only.
  **Stop the dev server first**: the container cannot hold both (see CLAUDE.md).
- Use `// biome-ignore lint/<rule>: <reason>` with a real explanation, never a bare suppression.

# Coding Standards

- Use descriptive names for variables and methods (no single letters except loop indices)
- Do not use the non-null assertion operator
- Prefer nullish coalescing (`??`) over OR (`||`) — but keep `||` where an empty string should fall through
  to the default, which is the intent in most `process.env.X || 'default'` reads in `settings.config.ts`
- Use optional chaining (`?.`) for safe property access
- Prefix unused variables with underscore (e.g., `_unusedParam`)
- Avoid `any` — use `unknown` if the type is truly unknown, then narrow
- Explicitly type function parameters, return types, and object literals
- Avoid Enums; use a const object plus a derived union, the pattern every `*.model.ts` already follows:

```typescript
export const BrandStatusEnum = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
} as const;

export type BrandStatus =
    (typeof BrandStatusEnum)[keyof typeof BrandStatusEnum];
```

- Use `readonly` modifiers for immutable properties and arrays
- Leverage TypeScript's utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`, etc.)
- Use discriminated unions with exhaustiveness checking for type narrowing
- Prefer `type` over `interface` unless a real benefit exists (declaration merging, `extends` on a class
  contract). The codebase is overwhelmingly `type` — match it.

# React and Next Specifics

- Prefer named exports for components; a `page.tsx` / `layout.tsx` still needs its default export.
- Type components through their props type rather than `React.FC`.
- Derive prop types from what already exists (`ComponentProps<typeof X>`, `Pick<EntityModel, ...>`) instead
  of restating a shape that can drift from its source.
- Server components are the default. Add `'use client'` only where a component needs state, effects or
  event handlers — and remember that adding it to a shared module pulls every importer client-side.
