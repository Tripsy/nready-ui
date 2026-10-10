---
paths:
  - "package.json"
  - "pnpm-workspace.yaml"
---

# Dependencies

**pnpm 11 no longer reads the `pnpm` field in `package.json`** - settings live in
`pnpm-workspace.yaml`. A dependency whose install scripts are blocked reports
`ERR_PNPM_IGNORED_BUILDS` and pnpm writes a placeholder into `allowBuilds` there for you to
resolve; setting it in `package.json` is silently ignored with a warning. This matters for
anything whose postinstall fetches a binary (`@sentry/cli` downloads the uploader that
`next build` uses for source maps), because the build still succeeds without it and only the
downstream artefact is missing.
