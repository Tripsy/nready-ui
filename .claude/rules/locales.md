---
paths:
  - "src/locales/**"
  - "src/helpers/validator.helper.ts"
  - "src/app/(dashboard)/**"
  - "src/components/**"
---

# Locales and validation messages

Translation files are `src/locales/<lang>/*.json`, registered per-language in
`src/locales/<lang>/index.ts`; `NEXT_PUBLIC_LANGUAGE_SUPPORTED` in `.env` controls which
languages are active.

Validation messages common to several entities live in `shared.json` (`shared.validation`); an
entity spreads `sharedValidatorMessages` into its own key list and calls
`resolveValidatorMessages()` (`src/helpers/validator.helper.ts`), which pulls the shared keys
from `shared.validation` and the rest from `<entity>.validation`. Only genuinely
entity-specific wording belongs in the latter.

To find unused keys and check that every language has the same keys, run
`node .claude/scripts/audit-locales.cjs [--list] [--json <file>]` on the host (no container).
It exits 1 on any unused key or mismatch. It errs towards "used", so grep a reported key
before deleting it.

## Key conventions (dashboard and shared components)

No user-facing English is hard-coded. Keys live in `<entity>.json`, one label per field however
many screens show it:

- `<entity>.field.<name>` - a field label shared by columns, filters, form and view, named after
  the form's `fieldName` / the column's `field`. The global search box is `field.search`; a
  second search box is `field.<its fieldName>`.
- `<entity>.section.<name>` - a heading in a view or form, including tab labels.
- `<entity>.text.<name>` - any other copy. Placeholders are `text.placeholder_<field>`; a label
  carrying a slot (`Code (max {{max}} characters)`) is `text.label_<field>`, not the field label.
- `<entity>.enum.<name>.<value>` - one key per enum value; status keeps `<entity>.status.<value>`.
  English is what `formatEnumLabel` prints. Currency and language codes are not copy: a language
  shows its own name through `languageOwnName()`.
- Shared wording lives in `dashboard.text.*` (yes/no, weekdays, `label_set_status_to`,
  `tab_errors`, `label_move_up/down`, ...) and `app.*` (`app.form.*`, `app.window.*`).

How the code reads them:

- **Components** declare a module-level `const TRANSLATION_KEYS = [...] as const` and call
  `useTranslation(TRANSLATION_KEYS)` once. A sub-component in the same file takes the parent's
  `translations` as a typed prop (`type TranslationsType = Record<(typeof TRANSLATION_KEYS)[number], string>`)
  rather than calling the hook again.
- **Definitions** resolve column headers in a second `translateBatch([...], '<entity>')` inside the
  `Promise.all` next to the action titles, used as `labels['field.x']`. Enum keys there are
  relative: `...enumTranslationKeys('enum.type', Enum)` + `translateEnumLabel(labels, 'enum.type', v)`.
- **Enums**: `enumTranslationKeys(prefix, Enum)` for the key list and
  `translateEnumLabel(translations, prefix, value)` for the label (falls back to
  `formatEnumLabel`). Option lists are a `useMemo` inside the component, never module-level.
- **Sentences with values** are one key with `{{slots}}`, filled by `replaceVars` (which returns
  `''` for a template that has not loaded). A sentence wrapping an element uses `<SlotText>`
  (`src/components/slot-text.component.tsx`). Never concatenate two keys or build copy from a
  lowercased label; a plural becomes a slot or a neutral unit ("Slots remaining: {{count}}").
- **Models hold no wording**: a display helper takes its wording from the caller
  (`displayCartOwner(entry, { user, guest })`, `displayRatingValue(entry, reactionLabel)`), and
  label maps are enum keys. Relative dates take the language: `timeAgo(date, language)`.
- **Not copy**: class names, date formats, thrown errors, logger messages, values sent to the
  backend, brand names, HeroUI's own built-in aria labels.
