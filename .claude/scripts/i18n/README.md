# Dashboard i18n tooling

Moves hard-coded English in a Next.js dashboard into locale keys for every language in
`src/locales/`. Built for nready-ui; it works on any project with the same shape: a
`src/app/(dashboard)/dashboard/<entity>/` layout, `useTranslation`, `translateBatch`,
`<entity>.definition.ts` files and `src/locales/<lang>/<ns>.json`.

The scripts do the mechanical part. Each entity still needs hand work on what they report.

## Setup in the target project (e.g. star-ui)

1. Copy this folder and the audit script:
   ```bash
   cp -R ../nready-ui/.claude/scripts/i18n .claude/scripts/i18n
   cp ../nready-ui/.claude/scripts/audit-locales.cjs .claude/scripts/
   echo ".i18n-work/" >> .gitignore
   ```
2. Copy the helpers the converted code imports, or check the target already has them:
   - `src/helpers/string.helper.ts`: `enumTranslationKeys`, `translateEnumLabel`,
     `languageOwnName`, and `replaceVars` returning `''` for `undefined`
   - `src/components/slot-text.component.tsx` (`SlotText`)
   - `src/helpers/date.helper.ts`: `ISO_WEEKDAYS` with `labelKey`, `ISO_WEEKDAY_KEYS`,
     `timeAgo(date, language)`
   Prove each with a runtime probe before relying on it.
3. Run everything **from the project root**. The environment variables:

   | Variable | Default | Used by |
   |---|---|---|
   | `I18N_ROOT` | current directory | all |
   | `I18N_WORK` | `$I18N_ROOT/.i18n-work` | key files (`keys/`) and backups (`backup/`) |
   | `I18N_DASH` | `$I18N_ROOT/src/app/(dashboard)/dashboard` | `run.sh`, `m.py` |
   | `I18N_CONTAINER` | none, **required** | `tsc.sh` (e.g. `star-ui.test`) |
   | `I18N_CONTAINER_ROOT` | `/var/www/html` | `tsc.sh` |

   `glossary.ro.json` holds the shared Romanian terms that `draft.cjs` checks first. If the second
   language isn't Romanian, add `glossary.<lang>.json` and pass the language: `draft.cjs <ns> <lang>`.

## The tools

| Tool | What it does |
|---|---|
| `scan-copy.cjs <path...>` | Lists JSX text, strings and templates that read like copy (`file:line  kind  text`). It misses acronym-only and lowercase labels (`"VAT"`, `labelText="layout"`), so grep for those. |
| `convert.cjs <ns> <path...> [--dry]` | Rewrites recognizable spots (`labelText=`, `label=`, `title=`, `placeholderText=`, `aria-label=`, whole JSX text, `header:` in definitions) into keys. Adds `TRANSLATION_KEYS`, the hook and imports, and wraps the definition's labels batch. Writes English to `keys/<ns>.en.json` and prints **LEFT** (not handled) and **CONFLICT** (one key, two texts). It is idempotent. |
| `enumify.cjs <ns> <path...> [--prefix Enum=ns.enum.x]` | Moves module-level `toOptionsFromEnum(Enum, formatEnumLabel)` and `Object.values(Enum).map(...formatEnumLabel)` lists into components as a `useMemo` with `translateEnumLabel`. Skips currency and language enums. Reports `formatEnumLabel(expr)` and `capitalize: true` as LEFT. |
| `propify.cjs <file> <SubComponent...>` | Turns sub-components that call the hook into ones taking the parent's `translations` as a typed prop, and updates their call sites. |
| `run.sh <entity> [ns]` | Backup, then `convert`, `enumify` and `scan` for one entity folder. |
| `m.py` | Hand-edit helpers: `rep`, `addkeys`, `key`, `rekey`, `unkey`, `after_imports`, `create_label`, `cap_column`, `enum_value`, `module_list_to_memo`, `merge_local`, `yes_no`, `to_shared`, `set_status_label`, `node_import`. |
| `addimport.cjs <file> <name> <from>` | Adds a named import, sorted among the `@/` imports. |
| `draft.cjs <ns> [lang]` | Pre-fills `keys/<ns>.<lang>.json` from the glossary and existing en/<lang> pairs, then prints what is still **MISSING**. Review what it fills: it has mistranslated before ("Order" as sequence, "Ordine", when a purchase order was meant). |
| `apply.cjs <ns...>` | Merges the key files into `src/locales/*/<ns>.json`. It refuses to overwrite a different text and writes nothing if any language is missing a key. |
| `verify.cjs <path...>` | Checks that every key the code references (literals, `labels[...]`, batch entries, `enumTranslationKeys` x enum values) exists as a string in every language. |
| `tsc.sh <file...> \| @listfile` | Targeted `tsc` in the container through `tsconfig.probe.json`. It doesn't need the dev server stopped. |
| `../audit-locales.cjs [--list]` | Unused keys and en/other parity. Exits 1 on either. |

Known gotcha: `m.py`'s `from m import *` skips underscore names, so use `node_import` and
`dedupe_lists`, not `_node_import`. Very long lines with non-ASCII text in a script need a
`# -*- coding: utf-8 -*-` header.

## Workflow

Run `node .claude/scripts/audit-locales.cjs --list` first and remove dead keys, so new keys
don't land in dead namespaces. Then convert the shared dashboard components (`_components`,
windows, form elements) by hand. After that, go entity by entity, smallest first:

```bash
T=.claude/scripts/i18n
$T/run.sh <entity>                       # mechanical pass + report
# hand work on LEFT / CONFLICT (m.py helpers), then
node $T/propify.cjs <file> <SubComponent>   # for each NOTE "N components use keys"
node $T/draft.cjs <entity>               # fill MISSING into .i18n-work/keys/<entity>.ro.json
node $T/apply.cjs <entity> dashboard app
node $T/verify.cjs "src/app/(dashboard)/dashboard/<entity>"
I18N_CONTAINER=star-ui.test $T/tsc.sh "src/app/(dashboard)/dashboard/<entity>"/*.ts*
node $T/scan-copy.cjs "src/app/(dashboard)/dashboard/<entity>"   # until only non-copy remains
```

Check model helpers too (`grep -rn "return '[A-Z]" src/models`). Any helper that returns words
takes its wording from the caller as a parameter, and every label map becomes enum keys.

Finish with `verify.cjs src`, the audit, a targeted `tsc` over every changed file, and a browser
pass in the second language. `?lang=ro` switches the language. For the browser pass, restart the
dev server with a clean cache every ~10 compiled routes (watch `docker stats`), or it gets OOM-killed.

## Prompt to start a session

Paste this into a session on the target project, after the setup above:

> Translate every hard-coded English string in this project's dashboard into locale keys, for
> every language in `src/locales/`. Use the tooling in `.claude/scripts/i18n/` and follow its
> README (workflow, conventions, gotchas). The conventions are in the "Key conventions" section of
> `../nready-ui/.claude/rules/locales.md`: copy that section into this project's rules once
> confirmed. First check that the helpers listed in the README setup exist here, and prove them with a
> runtime probe. Run the unused-locale audit before starting. Shared dashboard components first,
> then entities from smallest to largest. Keep a progress log in `.i18n-work/progress.md`, so
> a context reset loses nothing. Don't commit, don't run biome, and never `git checkout` to undo;
> restore from `.i18n-work/backup/` instead. If the dev server dies while compiling pages, clean
> its cache and restart it with the project's dev-stack command. Report what was translated, which
> model helpers changed signature, which shared keys were added, what was left as non-copy, and the
> second-language terms that most need a native speaker's review.
