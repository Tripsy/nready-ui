---
paths:
  - "src/locales/**"
  - "src/helpers/validator.helper.ts"
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
